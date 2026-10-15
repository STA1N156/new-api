package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/samber/hot"
	"gorm.io/gorm"
)

const statisticsCacheSeconds = 30

type statisticsCacheKey struct {
	db, logs *gorm.DB
	date     string
	days     int
}

type statisticsRequestSnapshot struct {
	end, logID int64
	rows       []StatisticsHour
}

type statisticsCacheEntry struct {
	mu                sync.Mutex
	result            *DailyStatistics
	current, previous *statisticsRequestSnapshot
}

var statisticsCacheMu sync.Mutex
var statisticsCache = hot.NewHotCache[statisticsCacheKey, *statisticsCacheEntry](hot.LRU, 128).Build()

func invalidateStatisticsCache() {
	statisticsCacheMu.Lock()
	defer statisticsCacheMu.Unlock()
	statisticsCache.Purge()
}

func getCachedDailyStatistics(date, today string, days int, start, end, step int64, now time.Time) (*DailyStatistics, error) {
	key := statisticsCacheKey{DB, LOG_DB, date, days}
	statisticsCacheMu.Lock()
	entry, found, _ := statisticsCache.Get(key)
	if !found {
		entry = &statisticsCacheEntry{}
		statisticsCache.Set(key, entry)
	}
	statisticsCacheMu.Unlock()

	// Concurrent requests for the same range share a single calculation.
	entry.mu.Lock()
	defer entry.mu.Unlock()
	if entry.result != nil {
		age := now.Unix() - entry.result.AsOf
		if age >= 0 && age < statisticsCacheSeconds {
			return cloneDailyStatistics(entry.result), nil
		}
	}

	// ClickHouse does not provide the monotonic row IDs used for incremental scans.
	latestID := int64(-1)
	if !common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		if err := LOG_DB.Model(&Log{}).Select("COALESCE(MAX(id), 0)").Scan(&latestID).Error; err != nil {
			return nil, err
		}
	}
	current, err := updateStatisticsRequests(entry.current, start, end, step, latestID)
	if err != nil {
		return nil, err
	}
	previousStart, previousEnd := start-int64(days)*86400, end-int64(days)*86400
	previous, err := updateStatisticsRequests(entry.previous, previousStart, previousEnd, step, latestID)
	if err != nil {
		return nil, err
	}
	hours, err := getStatisticsBuckets(start, end, step, current.rows)
	if err != nil {
		return nil, err
	}
	previousHours, err := getStatisticsBuckets(previousStart, previousEnd, step, previous.rows)
	if err != nil {
		return nil, err
	}
	result := &DailyStatistics{Date: date, Today: today, Days: days, AsOf: now.Unix(), Hours: hours}
	for _, row := range previousHours {
		result.Previous.add(row)
	}
	// Publish only after all queries succeed; a failure must not advance checkpoints.
	entry.current, entry.previous, entry.result = current, previous, result
	return cloneDailyStatistics(result), nil
}

func cloneDailyStatistics(value *DailyStatistics) *DailyStatistics {
	result := *value
	result.Hours = append([]StatisticsHour(nil), value.Hours...)
	return &result
}

func statisticsRequestQuery(start, end, logID int64) *gorm.DB {
	subscription := `REPLACE(COALESCE(other, ''), ' ', '') LIKE '%"billing_source":"subscription"%'`
	query := LOG_DB.Model(&Log{}).
		Select("MIN(created_at) AS created_at, SUM(CASE WHEN type = ? THEN quota ELSE 0 END) AS consumed_quota, "+
			"SUM(CASE WHEN type = ? AND "+subscription+" THEN quota ELSE 0 END) AS subscription_consumed_quota, "+
			"MAX(CASE WHEN type = ? THEN CASE WHEN "+subscription+" THEN 1 ELSE 0 END END) AS consumed_subscription, "+
			"MAX(CASE WHEN "+subscription+" THEN 1 ELSE 0 END) AS request_subscription",
			LogTypeConsume, LogTypeConsume, LogTypeConsume).
		Where("created_at >= ? AND created_at < ? AND type IN ?", start, end, []int{LogTypeConsume, LogTypeError}).
		Group("user_id, request_id, CASE WHEN request_id IS NULL OR request_id = '' THEN id ELSE 0 END")
	if logID >= 0 {
		query = query.Where("id <= ?", logID)
	}
	return query
}

func scanStatisticsRequests(query *gorm.DB, step int64) ([]StatisticsHour, error) {
	bucket := fmt.Sprintf("created_at - ((created_at + 28800) %% %d)", step)
	var rows []StatisticsHour
	err := LOG_DB.Table("(?) AS requests", query).
		Select(bucket + " AS timestamp, COUNT(*) AS requests, SUM(consumed_quota) AS consumed_quota, " +
			"SUM(subscription_consumed_quota) AS subscription_consumed_quota, " +
			"SUM(COALESCE(consumed_subscription, request_subscription)) AS subscription_requests").
		Group(bucket).Scan(&rows).Error
	return rows, err
}

func updateStatisticsRequests(previous *statisticsRequestSnapshot, start, end, step, latestID int64) (*statisticsRequestSnapshot, error) {
	result := &statisticsRequestSnapshot{end: end, logID: latestID, rows: newStatisticsRows(start, end, step)}
	apply := func(query *gorm.DB, sign int64) error {
		rows, err := scanStatisticsRequests(query, step)
		if err != nil {
			return err
		}
		for _, row := range rows {
			target := &result.rows[(row.Timestamp-start)/step]
			target.Requests += sign * row.Requests
			target.SubscriptionRequests += sign * row.SubscriptionRequests
			target.ConsumedQuota += sign * row.ConsumedQuota
			target.SubscriptionConsumedQuota += sign * row.SubscriptionConsumedQuota
		}
		return nil
	}
	if previous == nil || latestID < 0 || latestID < previous.logID || end < previous.end {
		if err := apply(statisticsRequestQuery(start, end, latestID), 1); err != nil {
			return nil, err
		}
		return result, nil
	}
	copy(result.rows, previous.rows)
	if latestID == previous.logID && end == previous.end {
		return result, nil
	}

	// IDs find late-arriving rows too. Time bounds include rows that were already
	// written but lay beyond the previous partial-hour cutoff.
	var changed []struct {
		ID        int
		RequestID string
	}
	changedQuery := LOG_DB.Model(&Log{}).Select("id, request_id").
		Where("id > ? AND id <= ?", previous.logID, latestID).
		Where("created_at >= ? AND created_at < ? AND type IN ?", start, end, []int{LogTypeConsume, LogTypeError})
	if end > previous.end {
		entering := LOG_DB.Model(&Log{}).Select("id, request_id").
			Where("id <= ? AND created_at >= ? AND created_at < ? AND type IN ?", previous.logID, previous.end, end, []int{LogTypeConsume, LogTypeError})
		// Separate ID and time scans so both can use their existing indexes.
		changedQuery = LOG_DB.Table("(? UNION ALL ?) AS changed", changedQuery, entering)
	}
	err := changedQuery.Select("MIN(id) AS id, request_id").
		Group("request_id, CASE WHEN request_id IS NULL OR request_id = '' THEN id ELSE 0 END").Scan(&changed).Error
	if err != nil {
		return nil, err
	}
	for offset := 0; offset < len(changed); offset += 500 {
		var requestIDs []string
		var legacyIDs []int
		for _, row := range changed[offset:min(offset+500, len(changed))] {
			if row.RequestID == "" {
				legacyIDs = append(legacyIDs, row.ID)
			} else {
				requestIDs = append(requestIDs, row.RequestID)
			}
		}
		filter := LOG_DB.Where("request_id IN ?", requestIDs).Or("id IN ?", legacyIDs)
		// Replace affected request totals, rather than adding new log counts.
		// Retries can cross hour boundaries or change wallet/subscription source.
		if err := apply(statisticsRequestQuery(start, previous.end, previous.logID).Where(filter), -1); err != nil {
			return nil, err
		}
		if err := apply(statisticsRequestQuery(start, end, latestID).Where(filter), 1); err != nil {
			return nil, err
		}
	}
	return result, nil
}
