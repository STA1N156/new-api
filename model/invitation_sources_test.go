package model

import (
	"math"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newInvitationSubscriptionPlan(t *testing.T) *SubscriptionPlan {
	t.Helper()
	oldPrice, oldExchangeRate := operation_setting.Price, operation_setting.USDExchangeRate
	operation_setting.Price = 1
	operation_setting.USDExchangeRate = 10
	t.Cleanup(func() {
		operation_setting.Price = oldPrice
		operation_setting.USDExchangeRate = oldExchangeRate
		_ = getSubscriptionPlanCache().Purge()
	})
	plan := &SubscriptionPlan{Title: "Invitation subscription", Enabled: true, PriceAmount: 999, DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 15000000}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func TestInvitationPaidSubscriptionRewardsOrderAmountExactlyOnce(t *testing.T) {
	for _, provider := range []string{PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem, PaymentProviderWaffoPancake} {
		t.Run(provider, func(t *testing.T) {
			inviter, invitee := setupInvitationTest(t)
			plan := newInvitationSubscriptionPlan(t)
			order := SubscriptionOrder{UserId: invitee.Id, PlanId: plan.Id, Money: 600, TradeNo: "sub-reward-" + provider, PaymentProvider: provider, PaymentMethod: provider, Status: common.TopUpStatusPending}
			require.NoError(t, order.Insert())
			const callbacks = 4
			errs := make([]error, callbacks)
			var wg sync.WaitGroup
			for i := range errs {
				wg.Add(1)
				go func(index int) {
					defer wg.Done()
					errs[index] = CompleteSubscriptionOrder(order.TradeNo, "", provider, "")
				}(i)
			}
			wg.Wait()
			for _, err := range errs {
				require.NoError(t, err)
			}
			operation_setting.Price = 2
			require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", provider, ""))
			require.NoError(t, ManualCompleteTopUp(order.TradeNo, ""))
			require.NoError(t, DB.First(&inviter, inviter.Id).Error)
			require.NoError(t, DB.First(&invitee, invitee.Id).Error)
			assert.EqualValues(t, 24000000, inviter.AffTopUpQuota, "600 paid / 1 recharge price * 500000 quota units * 8% = 480 cookies at 10 cookies per USD")
			assert.EqualValues(t, 24000700, inviter.AffQuota)
			assert.Zero(t, invitee.Quota, "subscription payments do not top up the friend's wallet")
			count, err := CountUserSubscriptionsByPlan(invitee.Id, plan.Id)
			require.NoError(t, err)
			assert.EqualValues(t, 1, count)
			record := GetTopUpByTradeNo(order.TradeNo)
			require.NotNil(t, record)
			assert.Equal(t, inviter.Id, record.RewardInviterId)
			assert.Equal(t, 24000000, record.RewardQuota)
		})
	}
}

func TestInvitationSubscriptionRechargePriceConversion(t *testing.T) {
	setupInvitationTest(t)
	newInvitationSubscriptionPlan(t)
	for _, tc := range []struct {
		name    string
		price   float64
		money   float64
		quota   int
		wantErr bool
	}{
		{"fractional price", 2.5, 600, 120000000, false},
		{"round down raw quota", 3, 0.01, 1666, false},
		{"zero price", 0, 600, 0, true},
		{"negative price", -1, 600, 0, true},
		{"invalid price", math.NaN(), 600, 0, true},
		{"infinite price", math.Inf(1), 600, 0, true},
		{"quota overflow", 1e-12, 600, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.Price = tc.price
			quota, err := subscriptionInvitationQuota(&SubscriptionOrder{Money: tc.money, PaymentProvider: PaymentProviderEpay})
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.quota, quota)
		})
	}
}

func TestInvitationBalanceAndAdminSubscriptionsDoNotReward(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	plan := newInvitationSubscriptionPlan(t)
	require.NoError(t, DB.Model(&invitee).Update("quota", 1000000000).Error)
	require.NoError(t, PurchaseSubscriptionWithBalance(invitee.Id, plan.Id))
	_, err := AdminBindSubscription(invitee.Id, plan.Id, "admin")
	require.NoError(t, err)
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 700, inviter.AffQuota)
	assert.Zero(t, inviter.AffTopUpQuota)
}

func TestInvitationSubscriptionRewardFailureRollsBackActivation(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	plan := newInvitationSubscriptionPlan(t)
	require.NoError(t, DB.Model(&inviter).Update("aff_history", int64(math.MaxInt64)).Error)
	order := SubscriptionOrder{UserId: invitee.Id, PlanId: plan.Id, Money: 100, TradeNo: "sub-reward-overflow", PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.Error(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, ""))
	assert.Equal(t, common.TopUpStatusPending, GetSubscriptionOrderByTradeNo(order.TradeNo).Status)
	count, err := CountUserSubscriptionsByPlan(invitee.Id, plan.Id)
	require.NoError(t, err)
	assert.Zero(t, count)
	assert.Nil(t, GetTopUpByTradeNo(order.TradeNo))
}

func newInvitationRedemption(t *testing.T) *Redemption {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	code := &Redemption{Name: "Invitation redemption", Key: "invitation-redemption", Quota: 1000000, Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, code.Insert())
	t.Cleanup(func() { DB.Unscoped().Delete(code) })
	return code
}

func TestInvitationRedemptionRewardsFullCreditExactlyOnce(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	code := newInvitationRedemption(t)
	const attempts = 4
	errs := make([]error, attempts)
	var wg sync.WaitGroup
	for i := range errs {
		wg.Add(1)
		go func(index int) { defer wg.Done(); _, errs[index] = Redeem(code.Key, invitee.Id) }(i)
	}
	wg.Wait()
	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		}
	}
	assert.Equal(t, 1, successes)
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	require.NoError(t, DB.First(&invitee, invitee.Id).Error)
	assert.Equal(t, 1000000, invitee.Quota)
	assert.EqualValues(t, 80700, inviter.AffQuota)
	assert.EqualValues(t, 80000, inviter.AffTopUpQuota)
	require.NoError(t, DB.First(code, code.Id).Error)
	assert.Equal(t, inviter.Id, code.RewardInviterId)
	assert.Equal(t, 80000, code.RewardQuota)
}

func TestInvitationRedemptionFailureDoesNotIssueReward(t *testing.T) {
	for _, reason := range []string{"expired", "used", "disabled", "reward_overflow", "wallet_overflow"} {
		t.Run(reason, func(t *testing.T) {
			inviter, invitee := setupInvitationTest(t)
			code := newInvitationRedemption(t)
			switch reason {
			case "expired":
				require.NoError(t, DB.Model(code).Update("expired_time", common.GetTimestamp()-1).Error)
			case "used":
				require.NoError(t, DB.Model(code).Update("status", common.RedemptionCodeStatusUsed).Error)
			case "disabled":
				require.NoError(t, DB.Model(code).Update("status", common.RedemptionCodeStatusDisabled).Error)
			case "reward_overflow":
				require.NoError(t, DB.Model(&inviter).Update("aff_history", int64(math.MaxInt64)).Error)
			case "wallet_overflow":
				require.NoError(t, DB.Model(&invitee).Update("quota", common.MaxQuota-1).Error)
			}
			_, err := Redeem(code.Key, invitee.Id)
			require.Error(t, err)
			require.NoError(t, DB.First(&inviter, inviter.Id).Error)
			require.NoError(t, DB.First(&invitee, invitee.Id).Error)
			require.NoError(t, DB.First(code, code.Id).Error)
			assert.EqualValues(t, 700, inviter.AffQuota)
			assert.Zero(t, inviter.AffTopUpQuota)
			if reason == "wallet_overflow" {
				assert.Equal(t, common.MaxQuota-1, invitee.Quota)
			} else {
				assert.Zero(t, invitee.Quota)
			}
			if reason == "reward_overflow" || reason == "wallet_overflow" {
				assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
			}
		})
	}
}
