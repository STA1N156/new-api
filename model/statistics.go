package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type StatisticsHour struct {
	Timestamp         int64   `json:"timestamp"`
	Requests          int64   `json:"requests"`
	ConsumedQuota     int64   `json:"consumed_quota"`
	RedeemedQuota     int64   `json:"redeemed_quota"`
	RedeemedCount     int64   `json:"redeemed_count"`
	OnlineTopup       float64 `json:"online_topup"`
	SubscriptionTopup float64 `json:"subscription_topup"`
	TopupCount        int64   `json:"topup_count"`
}

type DailyStatistics struct {
	Date  string           `json:"date"`
	Today string           `json:"today"`
	Hours []StatisticsHour `json:"hours"`
}

var ErrStatisticsDate = errors.New("请选择今日或近30天内的日期")

func GetDailyStatistics(date string, now time.Time) (*DailyStatistics, error) {
	location := time.FixedZone("UTC+8", 8*60*60)
	today := now.In(location).Format(time.DateOnly)
	if date == "" {
		date = today
	}
	day, err := time.ParseInLocation(time.DateOnly, date, location)
	if err != nil || date > today || date < now.In(location).AddDate(0, 0, -29).Format(time.DateOnly) {
		return nil, ErrStatisticsDate
	}
	start, end := day.Unix(), day.AddDate(0, 0, 1).Unix()
	result := &DailyStatistics{Date: date, Today: today, Hours: make([]StatisticsHour, 24)}
	for i := range result.Hours {
		result.Hours[i].Timestamp = start + int64(i)*3600
	}

	// Retries can write several logs for one request; count it once, including failures.
	requests := LOG_DB.Model(&Log{}).
		Select("MIN(created_at) AS created_at, SUM(CASE WHEN type = ? THEN quota ELSE 0 END) AS consumed_quota", LogTypeConsume).
		Where("created_at >= ? AND created_at < ? AND type IN ?", start, end, []int{LogTypeConsume, LogTypeError}).
		Group("user_id, request_id, CASE WHEN request_id IS NULL OR request_id = '' THEN id ELSE 0 END")
	subscriptionTrades := DB.Model(&SubscriptionOrder{}).Select("1").Where("subscription_orders.trade_no = top_ups.trade_no")
	queries := []*gorm.DB{
		LOG_DB.Table("(?) AS requests", requests).
			Select("created_at - (created_at % 3600) AS timestamp, COUNT(*) AS requests, SUM(consumed_quota) AS consumed_quota").
			Group("created_at - (created_at % 3600)"),
		// Keep redeemed codes in historical totals after an administrator deletes them.
		DB.Unscoped().Model(&Redemption{}).
			Select("redeemed_time - (redeemed_time % 3600) AS timestamp, SUM(quota) AS redeemed_quota, COUNT(*) AS redeemed_count").
			Where("status = ? AND redeemed_time >= ? AND redeemed_time < ?", common.RedemptionCodeStatusUsed, start, end).
			Group("redeemed_time - (redeemed_time % 3600)"),
		DB.Model(&TopUp{}).
			Select("complete_time - (complete_time % 3600) AS timestamp, SUM(money) AS online_topup, COUNT(*) AS topup_count").
			Where("status = ? AND complete_time >= ? AND complete_time < ?", common.TopUpStatusSuccess, start, end).
			Where("payment_method <> ? AND payment_provider <> ?", PaymentMethodBalance, PaymentProviderBalance).
			Where("NOT EXISTS (?)", subscriptionTrades).
			Group("complete_time - (complete_time % 3600)"),
		// Paid subscriptions also create top-up records, excluded above to avoid double counting.
		DB.Model(&SubscriptionOrder{}).
			Select("complete_time - (complete_time % 3600) AS timestamp, SUM(money) AS subscription_topup, COUNT(*) AS topup_count").
			Where("status = ? AND complete_time >= ? AND complete_time < ?", common.TopUpStatusSuccess, start, end).
			Where("payment_method <> ? AND payment_provider <> ?", PaymentMethodBalance, PaymentProviderBalance).
			Group("complete_time - (complete_time % 3600)"),
	}
	for _, query := range queries {
		var rows []StatisticsHour
		if err := query.Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			hour := &result.Hours[(row.Timestamp-start)/3600]
			hour.Requests += row.Requests
			hour.ConsumedQuota += row.ConsumedQuota
			hour.RedeemedQuota += row.RedeemedQuota
			hour.RedeemedCount += row.RedeemedCount
			hour.OnlineTopup += row.OnlineTopup
			hour.SubscriptionTopup += row.SubscriptionTopup
			hour.TopupCount += row.TopupCount
		}
	}
	return result, nil
}
