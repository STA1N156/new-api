package model

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newQuotaLimitedSubscription(t *testing.T) (*SubscriptionPlan, *UserSubscription) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM subscription_pre_consume_records")
		_ = getSubscriptionPlanCache().Purge()
	})
	plan := &SubscriptionPlan{
		Title: "Weekly and five-hour quota", DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: 300, QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: 7 * 86400,
		QuotaLimits: SubscriptionQuotaLimits{{PeriodSeconds: 5 * 3600, AmountTotal: 50}},
	}
	require.NoError(t, DB.Create(plan).Error)
	sub, err := CreateUserSubscriptionFromPlanTx(DB, 7001, plan, "admin")
	require.NoError(t, err)
	return plan, sub
}

func TestSubscriptionQuotaLimitsPreConsumeSettlementAndRefund(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	assert.False(t, sub.AllowWalletOverflow)
	first, err := PreConsumeUserSubscription("limited-request", sub.UserId, "", 0, 20)
	require.NoError(t, err)
	repeated, err := PreConsumeUserSubscription("limited-request", sub.UserId, "", 0, 20)
	require.NoError(t, err)
	assert.Equal(t, first.PreConsumed, repeated.PreConsumed)
	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, 30, first.ChargedAt))
	require.Error(t, ReserveUserSubscriptionQuota(sub.Id, 1, first.ChargedAt))
	_, err = PreConsumeUserSubscription("over-limit", sub.UserId, "", 0, 1)
	require.ErrorContains(t, err, "subscription quota insufficient")
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 50, stored.AmountUsed)
	assert.EqualValues(t, 50, stored.QuotaLimits[0].AmountUsed)
	require.NoError(t, RefundSubscriptionPreConsume("limited-request"))
	require.NoError(t, RefundSubscriptionPreConsume("limited-request"))
	stored = getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 30, stored.AmountUsed)
	assert.EqualValues(t, 30, stored.QuotaLimits[0].AmountUsed)
}

func TestSubscriptionShortResetKeepsWeeklyCapAndValidity(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	now := GetDBTimestamp()
	sub.StartTime = now - 5*3600
	sub.LastResetTime = sub.StartTime
	sub.NextResetTime = sub.StartTime + 7*86400
	sub.NextQuotaResetTime = now
	sub.AmountUsed = 290
	sub.QuotaLimits[0].LastResetTime = sub.StartTime
	sub.QuotaLimits[0].AmountUsed = 50
	require.NoError(t, DB.Save(sub).Error)
	_, err := PreConsumeUserSubscription("new-short-cycle", sub.UserId, "", 0, 10)
	require.NoError(t, err)
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 300, stored.AmountUsed)
	assert.EqualValues(t, 10, stored.QuotaLimits[0].AmountUsed)
	assert.Equal(t, sub.EndTime, stored.EndTime)
	assert.Equal(t, sub.NextResetTime, stored.NextResetTime)
	_, err = PreConsumeUserSubscription("weekly-cap", sub.UserId, "", 0, 1)
	require.ErrorContains(t, err, "subscription quota insufficient")
}

func TestSubscriptionSettlementAboveEstimateIsCountedAndBlocksNextRequest(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	pre, err := PreConsumeUserSubscription("underestimated", sub.UserId, "", 0, 10)
	require.NoError(t, err)
	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, 45, pre.ChargedAt))
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 55, stored.AmountUsed)
	assert.EqualValues(t, 55, stored.QuotaLimits[0].AmountUsed)
	_, err = PreConsumeUserSubscription("blocked-after-settlement", sub.UserId, "", 0, 1)
	require.ErrorContains(t, err, "subscription quota insufficient")
}

func TestSubscriptionWeeklyResetDoesNotRefillCurrentShortWindow(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	now := GetDBTimestamp()
	sub.StartTime = now - 7*86400
	sub.LastResetTime = sub.StartTime
	sub.NextResetTime = now
	sub.AmountUsed = 300
	sub.QuotaLimits[0].LastResetTime = now - 3600
	sub.QuotaLimits[0].AmountUsed = 40
	require.NoError(t, DB.Save(sub).Error)
	_, err := PreConsumeUserSubscription("weekly-reset", sub.UserId, "", 0, 10)
	require.NoError(t, err)
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 10, stored.AmountUsed)
	assert.EqualValues(t, 50, stored.QuotaLimits[0].AmountUsed)
	assert.Equal(t, now+7*86400, stored.NextResetTime)
	assert.Equal(t, sub.EndTime, stored.EndTime)
	_, err = PreConsumeUserSubscription("short-still-full", sub.UserId, "", 0, 1)
	require.Error(t, err)
}

func TestSubscriptionLateRefundPreservesNewWindowUsage(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	now := GetDBTimestamp()
	sub.StartTime = now - 7*3600
	sub.LastResetTime = sub.StartTime
	sub.AmountUsed = 70
	sub.QuotaLimits[0].LastResetTime = now - 3600
	sub.QuotaLimits[0].AmountUsed = 20
	require.NoError(t, DB.Save(sub).Error)
	record := &SubscriptionPreConsumeRecord{RequestId: "late-refund", UserId: sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 50, Status: "consumed"}
	require.NoError(t, DB.Create(record).Error)
	require.NoError(t, DB.Model(record).Update("created_at", now-6*3600).Error)
	require.NoError(t, RefundSubscriptionPreConsume(record.RequestId))
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 20, stored.AmountUsed)
	assert.EqualValues(t, 20, stored.QuotaLimits[0].AmountUsed)
}

func TestSubscriptionScheduledAndAdminResetsIncludeAllExtraCycles(t *testing.T) {
	plan, sub := newQuotaLimitedSubscription(t)
	now := GetDBTimestamp()
	sub.StartTime = now - 24*3600
	sub.AmountUsed = 90
	sub.QuotaLimits = SubscriptionQuotaLimits{
		{PeriodSeconds: 5 * 3600, AmountTotal: 50, AmountUsed: 50, LastResetTime: now - 5*3600},
		{PeriodSeconds: 24 * 3600, AmountTotal: 100, AmountUsed: 90, LastResetTime: now - 3600},
	}
	sub.NextQuotaResetTime = now
	require.NoError(t, DB.Save(sub).Error)
	count, err := ResetDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	stored := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 90, stored.AmountUsed)
	assert.Zero(t, stored.QuotaLimits[0].AmountUsed)
	assert.EqualValues(t, 90, stored.QuotaLimits[1].AmountUsed)
	_, err = PreConsumeUserSubscription("daily-cap", sub.UserId, "", 0, 11)
	require.Error(t, err)
	_, err = AdminResetUserSubscriptionsByPlan(sub.UserId, plan.Id, false)
	require.NoError(t, err)
	stored = getSubscriptionResetSub(t, sub.Id)
	assert.Zero(t, stored.AmountUsed)
	assert.Zero(t, stored.QuotaLimits[0].AmountUsed)
	assert.Zero(t, stored.QuotaLimits[1].AmountUsed)
	assert.Equal(t, now, stored.QuotaLimits[0].LastResetTime)
	assert.Equal(t, now-3600, stored.QuotaLimits[1].LastResetTime)
}

func TestSubscriptionExpiredCannotResetOrConsume(t *testing.T) {
	_, sub := newQuotaLimitedSubscription(t)
	now := GetDBTimestamp()
	sub.EndTime = now
	sub.NextQuotaResetTime = now - 1
	sub.AmountUsed = 300
	sub.QuotaLimits[0].AmountUsed = 50
	require.NoError(t, DB.Save(sub).Error)
	count, err := ResetDueSubscriptions(10)
	require.NoError(t, err)
	assert.Zero(t, count)
	_, err = PreConsumeUserSubscription("expired", sub.UserId, "", 0, 1)
	require.ErrorContains(t, err, "no active subscription")
	assert.EqualValues(t, 300, getSubscriptionResetSub(t, sub.Id).AmountUsed)
}

func TestSubscriptionQuotaLimitsRejectInvalidConfiguration(t *testing.T) {
	for _, limits := range []SubscriptionQuotaLimits{
		{{PeriodSeconds: 0, AmountTotal: 50}},
		{{PeriodSeconds: math.MaxInt64, AmountTotal: 50}},
		{{PeriodSeconds: 18000, AmountTotal: 0}},
		{{PeriodSeconds: 18000, AmountTotal: math.MaxInt64}},
		{{PeriodSeconds: 18000, AmountTotal: 50}, {PeriodSeconds: 18000, AmountTotal: 60}},
	} {
		plan := &SubscriptionPlan{QuotaLimits: limits}
		require.Error(t, plan.ValidateQuotaLimits())
	}
	_, err := subscriptionQuotaAfterDelta(100, 0, math.MaxInt64, false)
	require.Error(t, err)
	used, err := subscriptionQuotaAfterDelta(100, 300, math.MinInt64, false)
	require.NoError(t, err)
	assert.Zero(t, used)
}
