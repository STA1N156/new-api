package model

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func prepareStatisticsCacheTest(t *testing.T) {
	t.Helper()
	invalidateStatisticsCache()
	t.Cleanup(invalidateStatisticsCache)
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
}

func TestDailyStatisticsResultCache(t *testing.T) {
	prepareStatisticsCacheTest(t)
	now := time.Date(2026, 10, 16, 10, 30, 0, 0, time.FixedZone("UTC+8", 8*3600))
	first, err := GetDailyStatistics("", now, 1)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&Log{UserId: 9138, RequestId: "cached-new", Type: LogTypeConsume, CreatedAt: now.Unix() + 1, Quota: 7}).Error)
	first.Hours[0].Requests = 999
	cached, err := GetDailyStatistics("", now.Add(29*time.Second), 1)
	require.NoError(t, err)
	require.Equal(t, now.Unix(), cached.AsOf)
	require.Zero(t, cached.Hours[0].Requests)
	require.Zero(t, cached.Hours[10].Requests)
	refreshed, err := GetDailyStatistics("", now.Add(30*time.Second), 1)
	require.NoError(t, err)
	require.EqualValues(t, 1, refreshed.Hours[10].Requests)
	require.EqualValues(t, 7, refreshed.Hours[10].ConsumedQuota)
}

func TestDailyStatisticsIncrementalRetriesAndLateRows(t *testing.T) {
	prepareStatisticsCacheTest(t)
	now := time.Date(2026, 10, 17, 10, 59, 40, 0, time.FixedZone("UTC+8", 8*3600))
	start := now.Add(-10*time.Hour - 59*time.Minute - 40*time.Second).Unix()
	require.NoError(t, DB.Create(&[]Log{
		{UserId: 9138, RequestId: "retry-boundary", Type: LogTypeError, CreatedAt: start + 10*3600 + 59*60},
		{UserId: 9138, RequestId: "future", Type: LogTypeConsume, CreatedAt: start + 11*3600, Quota: 11},
	}).Error)
	first, err := GetDailyStatistics("", now, 1)
	require.NoError(t, err)
	require.EqualValues(t, 1, first.Hours[10].Requests)
	require.NoError(t, DB.Create(&[]Log{
		{UserId: 9138, RequestId: "retry-boundary", Type: LogTypeConsume, CreatedAt: start + 11*3600 + 10, Quota: 50, Other: `{"billing_source":"subscription"}`},
		{UserId: 9138, Type: LogTypeConsume, CreatedAt: start + 5*3600, Quota: 7},
	}).Error)
	refreshed, err := GetDailyStatistics("", now.Add(31*time.Second), 1)
	require.NoError(t, err)
	require.Equal(t, StatisticsHour{Timestamp: start + 10*3600, Requests: 1, SubscriptionRequests: 1, ConsumedQuota: 50, SubscriptionConsumedQuota: 50}, refreshed.Hours[10])
	require.Equal(t, StatisticsHour{Timestamp: start + 11*3600, Requests: 1, ConsumedQuota: 11}, refreshed.Hours[11])
	require.EqualValues(t, 1, refreshed.Hours[5].Requests)
	require.EqualValues(t, 7, refreshed.Hours[5].ConsumedQuota)
}

func TestDailyStatisticsIncrementalPreviousPeriod(t *testing.T) {
	for _, days := range []int{1, 7, 30} {
		t.Run((time.Duration(days*24) * time.Hour).String(), func(t *testing.T) {
			prepareStatisticsCacheTest(t)
			now := time.Date(2026, 10, 18, 10, 30, 0, 0, time.FixedZone("UTC+8", 8*3600))
			previous := now.AddDate(0, 0, -days)
			require.NoError(t, DB.Create(&[]Log{
				{UserId: 9138, RequestId: "previous-retry", Type: LogTypeError, CreatedAt: previous.Unix() - 60},
				{UserId: 9138, RequestId: "previous-retry", Type: LogTypeConsume, CreatedAt: previous.Unix() + 10, Quota: 20},
			}).Error)
			first, err := GetDailyStatistics("", now, days)
			require.NoError(t, err)
			require.EqualValues(t, 1, first.Previous.Requests)
			require.Zero(t, first.Previous.ConsumedQuota)
			refreshed, err := GetDailyStatistics("", now.Add(31*time.Second), days)
			require.NoError(t, err)
			require.EqualValues(t, 1, refreshed.Previous.Requests)
			require.EqualValues(t, 20, refreshed.Previous.ConsumedQuota)
		})
	}
}

func TestDailyStatisticsRefreshesPaymentTotals(t *testing.T) {
	prepareStatisticsCacheTest(t)
	now := time.Date(2026, 10, 19, 10, 30, 0, 0, time.FixedZone("UTC+8", 8*3600))
	_, err := GetDailyStatistics("", now, 1)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&TopUp{UserId: 9138, TradeNo: "cached-payment", Status: common.TopUpStatusSuccess, CompleteTime: now.Unix() - 3600, Money: 42}).Error)
	refreshed, err := GetDailyStatistics("", now.Add(30*time.Second), 1)
	require.NoError(t, err)
	require.Equal(t, 42.0, refreshed.Hours[9].OnlineTopup)
	require.EqualValues(t, 1, refreshed.Hours[9].TopupCount)
}

func TestDailyStatisticsCacheInvalidatedAfterLogCleanup(t *testing.T) {
	prepareStatisticsCacheTest(t)
	now := time.Date(2026, 10, 20, 10, 30, 0, 0, time.FixedZone("UTC+8", 8*3600))
	require.NoError(t, DB.Create(&Log{UserId: 9138, RequestId: "cleanup", Type: LogTypeConsume, CreatedAt: now.Unix() - 60, Quota: 7}).Error)
	first, err := GetDailyStatistics("", now, 1)
	require.NoError(t, err)
	require.EqualValues(t, 1, first.Hours[10].Requests)
	_, err = DeleteOldLogBatch(context.Background(), now.Unix(), 100)
	require.NoError(t, err)
	refreshed, err := GetDailyStatistics("", now.Add(time.Second), 1)
	require.NoError(t, err)
	require.Zero(t, refreshed.Hours[10].Requests)
}
