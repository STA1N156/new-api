package model

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type RankingTokenHour struct {
	CreatedAt int64  `gorm:"primaryKey;autoIncrement:false"`
	ModelName string `gorm:"primaryKey;size:191"`
	TokenUsed int64
}

type RankingSnapshotState struct {
	ID           int `gorm:"primaryKey;autoIncrement:false"`
	LegacyBefore int64
	NextHour     int64
	Ready        bool
}

// Only this dedicated state row is locked; request logging never uses it.
func RefreshRankingSnapshot(ctx context.Context, now time.Time) (catchingUp bool, err error) {
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var state RankingSnapshotState
		result := lockForUpdate(tx).First(&state, 1)
		if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
			return result.Error
		}
		currentHour := now.Unix() / 3600 * 3600
		logs := LOG_DB.WithContext(ctx)
		if LOG_DB == DB {
			logs = tx
		}
		if result.Error == gorm.ErrRecordNotFound {
			var latest QuotaData
			if err := tx.Select("created_at").Order("created_at DESC").Limit(1).Find(&latest).Error; err != nil {
				return err
			}
			cutoff := latest.CreatedAt
			if cutoff == 0 {
				var first Log
				if err := logs.Select("created_at").Order("created_at ASC").Limit(1).Find(&first).Error; err != nil {
					return err
				}
				cutoff = first.CreatedAt / 3600 * 3600
				if cutoff == 0 {
					cutoff = currentHour
				}
			}
			state = RankingSnapshotState{ID: 1, LegacyBefore: cutoff, NextHour: cutoff}
			if err := tx.Create(&state).Error; err != nil {
				return err
			}
		}
		hour := min(state.NextHour, currentHour)
		catchingUp = hour < currentHour
		hours := []int64{hour}
		if !catchingUp && hour-3600 >= state.LegacyBefore {
			// Re-read the preceding hour to include inserts that committed late.
			hours = append(hours, hour-3600)
		}
		for _, start := range hours {
			var rows []RankingTokenHour
			if err := logs.Model(&Log{}).
				Select("model_name, SUM(prompt_tokens + completion_tokens) AS token_used").
				Where("type = ? AND model_name <> '' AND created_at >= ? AND created_at < ?", LogTypeConsume, start, start+3600).
				Group("model_name").Scan(&rows).Error; err != nil {
				return err
			}
			for i := range rows {
				rows[i].CreatedAt = start
			}
			if err := tx.Where("created_at = ?", start).Delete(&RankingTokenHour{}).Error; err != nil {
				return err
			}
			if len(rows) > 0 {
				if err := tx.CreateInBatches(rows, 200).Error; err != nil {
					return err
				}
			}
		}
		if catchingUp {
			state.NextHour = hour + 3600
		} else {
			state.NextHour = currentHour
			state.Ready = true
		}
		return tx.Save(&state).Error
	})
	return catchingUp, err
}

func rankingQuotaSource(startTime, endTime int64) (*gorm.DB, error) {
	var state RankingSnapshotState
	err := DB.First(&state, 1).Error
	if err == gorm.ErrRecordNotFound || (err == nil && !state.Ready) {
		return applyRankingQuotaTimeRange(DB.Table("quota_data"), startTime, endTime), nil
	}
	if err != nil {
		return nil, err
	}
	legacy := DB.Table("quota_data").Select("model_name, created_at, token_used").Where("created_at < ?", state.LegacyBefore)
	recent := DB.Model(&RankingTokenHour{}).Select("model_name, created_at, token_used")
	legacy = applyRankingQuotaTimeRange(legacy, startTime, endTime)
	recent = applyRankingQuotaTimeRange(recent, startTime, endTime)
	return DB.Table("(? UNION ALL ?) AS ranking_tokens", legacy, recent), nil
}
