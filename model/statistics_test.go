package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDailyStatistics(t *testing.T) {
	oldPrice, oldQuotaPerUnit := operation_setting.Price, common.QuotaPerUnit
	operation_setting.Price, common.QuotaPerUnit = 1, 500000
	t.Cleanup(func() { operation_setting.Price, common.QuotaPerUnit = oldPrice, oldQuotaPerUnit })
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	t.Cleanup(func() { DB.Unscoped().Where("user_id = ?", 9137).Delete(&Redemption{}) })
	day := time.Date(2026, 9, 22, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600))
	start := day.Unix()
	now := day.Add(24*time.Hour - time.Second)
	logs := []Log{
		{UserId: 9137, RequestId: "retry", Type: LogTypeError, CreatedAt: start + 1},
		{UserId: 9137, RequestId: "retry", Type: LogTypeConsume, CreatedAt: start + 2, Quota: 123},
		{UserId: 9137, RequestId: "failed", Type: LogTypeError, CreatedAt: start + 3},
		{UserId: 9137, RequestId: "free", Type: LogTypeConsume, CreatedAt: start + 3600, Quota: 0},
		{UserId: 9137, RequestId: "last-hour", Type: LogTypeConsume, CreatedAt: start + 86399, Quota: 456},
		{UserId: 9137, RequestId: "before", Type: LogTypeConsume, CreatedAt: start - 1, Quota: 999},
		{UserId: 9137, RequestId: "after", Type: LogTypeConsume, CreatedAt: start + 86400, Quota: 999},
		{UserId: 9137, RequestId: "admin", Type: LogTypeManage, CreatedAt: start + 1, Quota: 999},
	}
	require.NoError(t, DB.Create(&logs).Error)
	redemptions := []Redemption{
		{UserId: 9137, Key: "stats-used", Status: common.RedemptionCodeStatusUsed, RedeemedTime: start + 3600, Quota: 50000},
		{UserId: 9137, Key: "stats-deleted", Status: common.RedemptionCodeStatusUsed, RedeemedTime: start + 3601, Quota: 100000, DeletedAt: gorm.DeletedAt{Time: now, Valid: true}},
		{UserId: 9137, Key: "stats-unused", Status: common.RedemptionCodeStatusEnabled, RedeemedTime: start + 3600, Quota: 999999},
		{UserId: 9137, Key: "stats-before", Status: common.RedemptionCodeStatusUsed, RedeemedTime: start - 1, Quota: 999999},
	}
	require.NoError(t, DB.Create(&redemptions).Error)
	orders := []SubscriptionOrder{
		{UserId: 9137, TradeNo: "stats-sub", Money: 600, Status: common.TopUpStatusSuccess, CompleteTime: start + 7200, PaymentMethod: "alipay"},
		{UserId: 9137, TradeNo: "stats-balance", Money: 900, Status: common.TopUpStatusSuccess, CompleteTime: start + 7200, PaymentMethod: PaymentMethodBalance},
		{UserId: 9137, TradeNo: "stats-pending", Money: 800, Status: common.TopUpStatusPending, CompleteTime: start + 7200},
	}
	require.NoError(t, DB.Create(&orders).Error)
	topups := []TopUp{
		{UserId: 9137, TradeNo: "stats-direct", Money: 88.5, Status: common.TopUpStatusSuccess, CompleteTime: start + 7200},
		{UserId: 9137, TradeNo: "stats-sub", Money: 600, Status: common.TopUpStatusSuccess, CompleteTime: start + 7200},
		{UserId: 9137, TradeNo: "stats-unpaid", Money: 777, Status: common.TopUpStatusPending, CompleteTime: start + 7200},
		{UserId: 9137, TradeNo: "stats-future", Money: 888, Status: common.TopUpStatusSuccess, CompleteTime: start + 86400},
	}
	require.NoError(t, DB.Create(&topups).Error)

	statistics, err := GetDailyStatistics("2026-09-22", now.UTC(), 1)
	require.NoError(t, err)
	require.Equal(t, "2026-09-22", statistics.Date)
	require.Len(t, statistics.Hours, 24)
	require.Equal(t, StatisticsHour{Timestamp: start, Requests: 2, ConsumedQuota: 123}, statistics.Hours[0])
	require.InDelta(t, 0.3, statistics.Hours[1].RedemptionTopup, 0.000001)
	redemptionHour := statistics.Hours[1]
	redemptionHour.RedemptionTopup = 0
	require.Equal(t, StatisticsHour{Timestamp: start + 3600, Requests: 1, RedeemedQuota: 150000, RedeemedCount: 2, TopupCount: 2}, redemptionHour)
	require.Equal(t, StatisticsHour{Timestamp: start + 7200, OnlineTopup: 88.5, OnlineTopupCount: 1, SubscriptionTopup: 600, SubscriptionTopupCount: 1, TopupCount: 2}, statistics.Hours[2])
	require.Equal(t, StatisticsHour{Timestamp: start + 3*3600}, statistics.Hours[3])
	require.Equal(t, StatisticsHour{Timestamp: start + 23*3600, Requests: 1, ConsumedQuota: 456}, statistics.Hours[23])
}

func TestDailyStatisticsDateRange(t *testing.T) {
	now := time.Date(2026, 9, 21, 16, 30, 0, 0, time.UTC) // September 22 in UTC+8.
	for _, date := range []string{"2026-08-23", "2026-09-23", "bad-date", "2026-09-31"} {
		_, err := GetDailyStatistics(date, now, 1)
		require.ErrorIs(t, err, ErrStatisticsDate)
	}
	for _, date := range []string{"", "2026-08-24"} {
		statistics, err := GetDailyStatistics(date, now, 1)
		require.NoError(t, err)
		require.Equal(t, "2026-09-22", statistics.Today)
		if date == "" {
			require.Len(t, statistics.Hours, 1)
			require.Equal(t, "2026-09-22", statistics.Date)
		} else {
			require.Len(t, statistics.Hours, 24)
		}
	}
}
