package model

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRankingSnapshotPreservesHistoryAndRefreshesRecentTokens(t *testing.T) {
	for _, separateLogs := range []bool{false, true} {
		name := "shared database"
		if separateLogs {
			name = "separate log database"
		}
		t.Run(name, func(t *testing.T) {
			truncateTables(t)
			if separateLogs {
				logs, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
				require.NoError(t, err)
				require.NoError(t, logs.AutoMigrate(&Log{}))
				original := LOG_DB
				LOG_DB = logs
				t.Cleanup(func() {
					LOG_DB = original
					db, _ := logs.DB()
					_ = db.Close()
				})
			}
			require.NoError(t, DB.Create(&[]QuotaData{
				{ModelName: "model-a", CreatedAt: 3600, TokenUsed: 100},
				{ModelName: "model-a", CreatedAt: 7200, TokenUsed: 999},
			}).Error)
			require.NoError(t, LOG_DB.Create(&[]Log{
				{ModelName: "model-a", CreatedAt: 7500, Type: LogTypeConsume, PromptTokens: 30, CompletionTokens: 20},
				{ModelName: "model-b", CreatedAt: 8000, Type: LogTypeConsume, CompletionTokens: 40},
				{ModelName: "model-a", CreatedAt: 10801, Type: LogTypeConsume, CompletionTokens: 60},
				{ModelName: "model-a", CreatedAt: 10802, Type: LogTypeError, CompletionTokens: 999},
			}).Error)
			now := time.Unix(10900, 0)
			catchingUp, err := RefreshRankingSnapshot(context.Background(), now)
			require.NoError(t, err)
			require.True(t, catchingUp)
			old, err := GetRankingQuotaTotals(1, 20000)
			require.NoError(t, err)
			require.Equal(t, []RankingQuotaTotal{{ModelName: "model-a", TotalTokens: 1099}}, old)
			catchingUp, err = RefreshRankingSnapshot(context.Background(), now)
			require.NoError(t, err)
			require.False(t, catchingUp)
			for i := 0; i < 2; i++ {
				totals, err := GetRankingQuotaTotals(1, 20000)
				require.NoError(t, err)
				require.Equal(t, []RankingQuotaTotal{{ModelName: "model-a", TotalTokens: 210}, {ModelName: "model-b", TotalTokens: 40}}, totals)
				_, err = RefreshRankingSnapshot(context.Background(), now)
				require.NoError(t, err)
			}
			// A late commit in the preceding hour is picked up without double counting.
			require.NoError(t, LOG_DB.Create(&Log{ModelName: "model-a", CreatedAt: 7501, Type: LogTypeConsume, CompletionTokens: 7}).Error)
			_, err = RefreshRankingSnapshot(context.Background(), now)
			require.NoError(t, err)
			totals, err := GetRankingQuotaTotals(1, 20000)
			require.NoError(t, err)
			require.Equal(t, int64(217), totals[0].TotalTokens)
			buckets, err := GetRankingQuotaBuckets(1, 20000, 3600)
			require.NoError(t, err)
			require.Len(t, buckets, 4)
			recent, err := GetRankingQuotaTotals(10800, 11000)
			require.NoError(t, err)
			require.Equal(t, []RankingQuotaTotal{{ModelName: "model-a", TotalTokens: 60}}, recent)
			var legacyRows int64
			require.NoError(t, DB.Model(&QuotaData{}).Count(&legacyRows).Error)
			require.EqualValues(t, 2, legacyRows)
		})
	}
}
