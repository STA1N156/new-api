package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFestivalSubscriptionUsesPaidAmountOnce(t *testing.T) {
	user := setupFestivalTest(t)
	plan := SubscriptionPlan{Title: "Festival subscription", Enabled: true, PriceAmount: 99,
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 999 * festivalQuotaPerCookie}
	require.NoError(t, DB.Create(&plan).Error)
	order := SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, Money: 10,
		TradeNo: "festival-subscription", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	for range 2 {
		require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, "alipay"))
	}
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(100), status.CreditedCookies, "¥10 counts as 100 cookies regardless of plan price or quota")
	var credits []FestivalCredit
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&credits).Error)
	require.Len(t, credits, 1, "the receipt and callback retry must not count twice")
	assert.Equal(t, "subscription", credits[0].Source)
	assert.Equal(t, order.Id, credits[0].SourceID)
}

func TestFestivalSubscriptionExcludesBalanceAndOutsideWindow(t *testing.T) {
	user := setupFestivalTest(t)
	plan := SubscriptionPlan{Title: "Excluded subscription", Enabled: true, PriceAmount: 10,
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000}
	require.NoError(t, DB.Create(&plan).Error)
	require.NoError(t, DB.Model(&user).Update("quota", 100000000).Error)
	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
	for _, window := range []string{"upcoming", "ended"} {
		if window == "upcoming" {
			festivalStart = common.GetTimestamp() + 3600
		} else {
			festivalStart, festivalEnd = 1, common.GetTimestamp()-1
		}
		order := SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, Money: 10,
			TradeNo: "festival-" + window, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
		require.NoError(t, order.Insert())
		require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, "alipay"))
	}
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Zero(t, status.CreditedCookies)
}

func TestFestivalFailedSubscriptionDoesNotGrantProgress(t *testing.T) {
	user := setupFestivalTest(t)
	plan := SubscriptionPlan{Title: "Limited subscription", Enabled: true, MaxPurchasePerUser: 1,
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000}
	require.NoError(t, DB.Create(&plan).Error)
	_, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, &plan, "admin")
	require.NoError(t, err)
	order := SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, Money: 10,
		TradeNo: "festival-subscription-failed", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.Error(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, "alipay"))
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Zero(t, status.CreditedCookies)
}
