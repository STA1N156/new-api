package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBakingTest(t *testing.T) (User, *time.Time) {
	t.Helper()
	setupUserUpdateTestState(t)
	oldNow, oldUnit := bakingNow, common.QuotaPerUnit
	setting := operation_setting.GetGeneralSetting()
	oldSetting := *setting
	now := bakingStart.Add(time.Hour)
	bakingNow = func() time.Time { return now }
	common.QuotaPerUnit = 500000
	setting.CustomCurrencyExchangeRate = 10
	t.Cleanup(func() { bakingNow = oldNow; common.QuotaPerUnit = oldUnit; *setting = oldSetting })
	user := createUserBindTestUser(t)
	return user, &now
}

func TestBakingHistoryIncludesAllCompletedRounds(t *testing.T) {
	user, _ := setupBakingTest(t)
	require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, Used: 12, CreditedMicros: 6000 * bakingMicros}).Error)
	for serial := 1; serial <= 12; serial++ {
		require.NoError(t, DB.Create(&BakingRound{Event: bakingEvent, UserID: user.Id, Serial: serial, Status: "claimed"}).Error)
	}
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	require.Len(t, state.History, 12)
	assert.Equal(t, 12, state.History[0].Serial)
	assert.Equal(t, 1, state.History[11].Serial)
}

func TestBakingCreditBoundariesMilestonesAndDuplicateSource(t *testing.T) {
	user, now := setupBakingTest(t)
	credit := func(source string, cookies string) {
		t.Helper()
		require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
			return creditBakingCookies(tx, user.Id, source, decimal.RequireFromString(cookies), *now)
		}))
	}
	*now = bakingStart.Add(-time.Millisecond)
	credit("before", "7000")
	*now = bakingStart
	credit("first", "499.5")
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Zero(t, state.Granted)
	credit("fraction", "0.5")
	credit("fraction", "0.5")
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 3, state.Available)
	assert.Equal(t, float64(500), state.CreditedCookies)
	credit("rest", "5500")
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 50, state.Granted)
	credit("new-tier", "1000")
	*now = bakingEnd
	credit("after", "5000")
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 60, state.Granted)
	assert.Equal(t, float64(7000), state.CreditedCookies)
	assert.Equal(t, "ended", state.Phase)
}

func TestBakingOpensAtBeijingMidnight(t *testing.T) {
	user, now := setupBakingTest(t)
	// Beijing 2026-11-06 00:00 is 2026-11-05 16:00 UTC.
	opens := time.Date(2026, 11, 5, 16, 0, 0, 0, time.UTC)
	require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, CreditedMicros: 500 * bakingMicros}).Error)
	*now = opens.Add(-time.Millisecond)
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "upcoming", state.Phase)
	assert.Equal(t, opens.UnixMilli(), state.StartsAt)
	_, err = ExecuteBakingAction(user.Id, "start", BakingCommand{})
	assert.ErrorIs(t, err, ErrBakingClosed)
	*now = opens
	state, err = ExecuteBakingAction(user.Id, "start", BakingCommand{})
	require.NoError(t, err)
	assert.Equal(t, "active", state.Phase)
	require.NotNil(t, state.Round)
	assert.Equal(t, "ready", state.Round.Status)
}

func TestBakingPaidAndSubscriptionCreditUseDifferentAmounts(t *testing.T) {
	user, _ := setupBakingTest(t)
	order := TopUp{UserId: user.Id, Amount: 500, Money: 425, TradeNo: "baking-discount", Status: common.TopUpStatusPending, PaymentProvider: PaymentProviderEpay}
	require.NoError(t, order.Insert())
	_, err := RechargeEpay(order.TradeNo, "", "")
	require.NoError(t, err)
	_, err = RechargeEpay(order.TradeNo, "", "")
	require.NoError(t, err)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		subscription := &SubscriptionOrder{Id: 99, UserId: user.Id, Money: 10, PaymentProvider: PaymentProviderEpay}
		if err := creditBakingSubscription(tx, subscription); err != nil {
			return err
		}
		subscription.Id = 100
		subscription.PaymentProvider = PaymentProviderBalance
		return creditBakingSubscription(tx, subscription)
	}))
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(5100), state.CreditedCookies, "discounted direct credits keep their full cookie amount; external subscriptions use RMB times ten")
	assert.Equal(t, 40, state.Granted)
}

func TestBakingRedeemAndSubscriptionSettlementCreditOnce(t *testing.T) {
	user, _ := setupBakingTest(t)
	code := newInvitationRedemption(t)
	_, err := Redeem(code.Key, user.Id)
	require.NoError(t, err)
	_, err = Redeem(code.Key, user.Id)
	require.Error(t, err)
	plan := newInvitationSubscriptionPlan(t)
	order := SubscriptionOrder{UserId: user.Id, PlanId: plan.Id, Money: 48, TradeNo: "baking-subscription", PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, ""))
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "", PaymentProviderEpay, ""))
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), state.CreditedCookies, "20 redeemed cookies + 48 RMB subscription x 10")
	assert.Equal(t, 3, state.Available)
	require.NoError(t, DB.Model(&user).Update("quota", 1_000_000_000).Error)
	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), state.CreditedCookies, "balance purchases must not count twice")
}

func TestBakingRoundClaimIsExactlyOnceAndDoesNotEarnMoreIngredients(t *testing.T) {
	user, now := setupBakingTest(t)
	require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, CreditedMicros: 500 * bakingMicros}).Error)
	state, err := ExecuteBakingAction(user.Id, "start", BakingCommand{})
	require.NoError(t, err)
	_, err = ExecuteBakingAction(user.Id, "start", BakingCommand{})
	assert.ErrorIs(t, err, ErrBakingChanged)
	command := BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version}
	state, err = ExecuteBakingAction(user.Id, "bake", command)
	require.NoError(t, err)
	assert.Equal(t, "baking", state.Round.Status)
	assert.Zero(t, state.Round.Level)
	wait := state.Round.ReadyAt - now.UnixMilli()
	assert.GreaterOrEqual(t, wait, BakingMinDuration)
	assert.LessOrEqual(t, wait, BakingMaxDuration)
	pending, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, state.Round.ReadyAt, pending.Round.ReadyAt)
	encoded, err := common.Marshal(state)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "PendingSuccess")
	assert.NotContains(t, string(encoded), "pending_success")
	_, err = ExecuteBakingAction(user.Id, "claim", BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version})
	assert.ErrorIs(t, err, ErrBakingChanged)
	require.NoError(t, DB.Model(&BakingRound{}).Where("id = ?", state.Round.ID).UpdateColumn("pending_success", true).Error)
	*now = time.UnixMilli(state.Round.ReadyAt)
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 1, state.Round.Level)
	command = BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version}
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := range errs {
		wg.Add(1)
		go func(index int) { defer wg.Done(); _, errs[index] = ExecuteBakingAction(user.Id, "claim", command) }(i)
	}
	wg.Wait()
	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		} else {
			assert.ErrorIs(t, err, ErrBakingChanged)
		}
	}
	assert.Equal(t, 1, successes)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 1_000_000, user.Quota)
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 20, state.ClaimedCookies)
	assert.Equal(t, float64(500), state.CreditedCookies)
	assert.Equal(t, 2, state.Available)
}

func TestBakingWishingSettlementCreditsOnlyAClaimedSuccess(t *testing.T) {
	for _, success := range []bool{true, false} {
		name := "burnt"
		if success {
			name = "jackpot"
		}
		t.Run(name, func(t *testing.T) {
			user, now := setupBakingTest(t)
			require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, CreditedMicros: 500 * bakingMicros}).Error)
			state, err := ExecuteBakingAction(user.Id, "start", BakingCommand{})
			require.NoError(t, err)
			require.Len(t, state.Rewards, 7)
			require.Len(t, state.Chances, 6)
			assert.Equal(t, 10, state.Chances[5])
			require.NoError(t, DB.Model(&BakingRound{}).Where("id = ?", state.Round.ID).UpdateColumn("level", 5).Error)
			state, err = ExecuteBakingAction(user.Id, "bake", BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version})
			require.NoError(t, err)
			// Make the saved outcome deterministic without changing live probabilities.
			require.NoError(t, DB.Model(&BakingRound{}).Where("id = ?", state.Round.ID).UpdateColumn("pending_success", success).Error)
			*now = time.UnixMilli(state.Round.ReadyAt)
			state, err = GetBakingState(user.Id)
			require.NoError(t, err)
			require.NoError(t, DB.First(&user, user.Id).Error)
			assert.Zero(t, user.Quota, "the animation/result must not credit an unclaimed reward")
			command := BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version}
			_, err = ExecuteBakingAction(user.Id, "bake", command)
			assert.ErrorIs(t, err, ErrBakingChanged)
			if success {
				assert.Equal(t, 6, state.Round.Level)
				state, err = ExecuteBakingAction(user.Id, "claim", command)
				require.NoError(t, err)
				assert.Equal(t, 1111, state.ClaimedCookies)
				assert.Equal(t, float64(500), state.CreditedCookies)
				assert.Equal(t, 2, state.Available)
			} else {
				assert.Equal(t, "burnt", state.Round.Status)
			}
			_, err = ExecuteBakingAction(user.Id, "claim", command)
			assert.ErrorIs(t, err, ErrBakingChanged)
			require.NoError(t, DB.First(&user, user.Id).Error)
			if success {
				assert.Equal(t, 55_550_000, user.Quota)
			} else {
				assert.Zero(t, user.Quota)
			}
		})
	}
}

func TestBakingFailureAndForeignRoundCannotCreditWallet(t *testing.T) {
	user, now := setupBakingTest(t)
	require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, CreditedMicros: 500 * bakingMicros}).Error)
	state, err := ExecuteBakingAction(user.Id, "start", BakingCommand{})
	require.NoError(t, err)
	_, err = ExecuteBakingAction(user.Id, "claim", BakingCommand{RoundID: state.Round.ID + 1, Version: 0})
	assert.ErrorIs(t, err, ErrBakingChanged)
	state, err = ExecuteBakingAction(user.Id, "bake", BakingCommand{RoundID: state.Round.ID, Version: 0})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&BakingRound{}).Where("id = ?", state.Round.ID).UpdateColumn("pending_success", false).Error)
	*now = time.UnixMilli(state.Round.ReadyAt)
	state, err = GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "burnt", state.Round.Status)
	_, err = ExecuteBakingAction(user.Id, "claim", BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version})
	assert.ErrorIs(t, err, ErrBakingChanged)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Zero(t, user.Quota)
}

func TestBakingEventExpiryStopsNewActionsButKeepsEarnedRewardClaimable(t *testing.T) {
	user, now := setupBakingTest(t)
	require.NoError(t, DB.Create(&BakingAccount{Event: bakingEvent, UserID: user.Id, CreditedMicros: 500 * bakingMicros}).Error)
	state, err := ExecuteBakingAction(user.Id, "start", BakingCommand{})
	require.NoError(t, err)
	*now = bakingEnd
	command := BakingCommand{RoundID: state.Round.ID, Version: state.Round.Version}
	_, err = ExecuteBakingAction(user.Id, "bake", command)
	assert.ErrorIs(t, err, ErrBakingClosed)
	_, err = ExecuteBakingAction(user.Id, "start", BakingCommand{Version: 1})
	assert.ErrorIs(t, err, ErrBakingClosed)
	state, err = ExecuteBakingAction(user.Id, "claim", command)
	require.NoError(t, err)
	assert.Equal(t, 10, state.ClaimedCookies)
}
