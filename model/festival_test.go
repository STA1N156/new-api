package model

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupFestivalTest(t *testing.T) User {
	t.Helper()
	setupUserUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	start, end, clock := festivalStart, festivalEnd, festivalNow
	now := time.Now()
	festivalStart, festivalEnd = now.Unix()-60, now.Unix()+3600
	festivalNow = func() time.Time { return now }
	t.Cleanup(func() {
		festivalStart, festivalEnd, festivalNow = start, end, clock
		DB.Exec("DELETE FROM redemptions")
	})
	user := User{Username: "festival-user", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestFestivalCreditMilestonesAndWindow(t *testing.T) {
	user := setupFestivalTest(t)
	credits := []struct{ quota, earned int }{
		{300 * festivalQuotaPerCookie, 0},
		{200*festivalQuotaPerCookie - 1, 0}, {1, 1},
		{500 * festivalQuotaPerCookie, 3},
		{1000*festivalQuotaPerCookie - 1, 3}, {1, 5},
		{1000 * festivalQuotaPerCookie, 8},
		{1000*festivalQuotaPerCookie - 1, 8}, {1, 11},
		{1000 * festivalQuotaPerCookie, 15}, {3000 * festivalQuotaPerCookie, 15},
	}
	for index, credit := range credits {
		require.NoError(t, creditFestivalQuota(DB, "topup", index+1, user.Id, credit.quota, festivalStart))
		// Replayed source is ignored, even if its amount differs.
		require.NoError(t, creditFestivalQuota(DB, "topup", index+1, user.Id, credit.quota+1, festivalStart))
		status, err := GetFestivalStatus(user.Id)
		require.NoError(t, err)
		assert.Equal(t, credit.earned, status.Earned)
	}
	for index, timestamp := range []int64{festivalStart - 1, festivalEnd} {
		require.NoError(t, creditFestivalQuota(DB, "redemption", index+50, user.Id, festivalQuotaPerCookie, timestamp))
	}
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(8000), status.CreditedCookies)
	assert.Equal(t, 15, status.Remaining)
	other, err := GetFestivalStatus(user.Id + 1)
	require.NoError(t, err)
	assert.Zero(t, other.Earned)
	assert.Empty(t, other.Records)
}

func TestFestivalCountsActualTopUpAndRedemptionExactlyOnce(t *testing.T) {
	user := setupFestivalTest(t)
	order := TopUp{UserId: user.Id, Amount: 25, Money: 999, TradeNo: "festival-credit", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	_, err := RechargeEpay(order.TradeNo, "alipay", "")
	require.NoError(t, err)
	_, err = RechargeEpay(order.TradeNo, "alipay", "")
	require.NoError(t, err)
	code := Redemption{Key: "festival-code", Name: "festival", Quota: 250 * festivalQuotaPerCookie, Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, DB.Create(&code).Error)
	_, err = Redeem(code.Key, user.Id)
	require.NoError(t, err)
	_, err = Redeem(code.Key, user.Id)
	require.Error(t, err)
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), status.CreditedCookies, "credited quota, not order price")
	assert.Equal(t, 1, status.Earned)
	// Credit and eligibility share the payment transaction.
	require.NoError(t, DB.Model(&user).Update("quota", common.MaxQuota-1).Error)
	failed := TopUp{UserId: user.Id, Amount: 25, TradeNo: "festival-failed", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, failed.Insert())
	_, err = RechargeEpay(failed.TradeNo, "alipay", "")
	require.Error(t, err)
	status, err = GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), status.CreditedCookies)
}

func TestFestivalDrawRetriesDoNotDuplicateRewardsOrProgress(t *testing.T) {
	user := setupFestivalTest(t)
	require.NoError(t, creditFestivalQuota(DB, "topup", 1, user.Id, 500*festivalQuotaPerCookie, festivalStart))
	first, err := DrawFestival(user.Id, "festival-request-0001")
	require.NoError(t, err)
	second, err := DrawFestival(user.Id, "festival-request-0001")
	require.NoError(t, err)
	assert.Equal(t, first.ID, second.ID)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, first.Quota, user.Quota)
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), status.CreditedCookies)
	assert.Equal(t, 1, status.Earned)
	assert.Zero(t, status.Remaining)
	assert.Len(t, status.Records, 1)
	_, err = DrawFestival(user.Id, "festival-request-0002")
	require.ErrorContains(t, err, "No draw chances")
	festivalNow = func() time.Time { return time.Unix(festivalEnd, 0) }
	_, err = DrawFestival(user.Id, "festival-request-0003")
	require.ErrorContains(t, err, "ended")
	_, err = DrawFestival(user.Id, "festival-request-0001")
	require.NoError(t, err, "a lost success response can still be recovered after closing")
}

func TestFestivalDrawConcurrencyAndRollback(t *testing.T) {
	user := setupFestivalTest(t)
	require.NoError(t, creditFestivalQuota(DB, "topup", 1, user.Id, 500*festivalQuotaPerCookie, festivalStart))
	require.NoError(t, DB.Model(&user).Update("quota", common.MaxQuota-1).Error)
	_, err := DrawFestival(user.Id, "festival-overflow-01")
	require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)
	var count int64
	require.NoError(t, DB.Model(&FestivalDraw{}).Count(&count).Error)
	assert.Zero(t, count, "failed wallet credit must not consume a chance")
	require.NoError(t, DB.Model(&user).Update("quota", 0).Error)
	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			_, errs[index] = DrawFestival(user.Id, fmt.Sprintf("festival-concurrent-%d", index))
		}(i)
	}
	wg.Wait()
	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		}
	}
	assert.Equal(t, 1, successes)
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Len(t, status.Records, 1)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, status.Records[0].Cookies*festivalQuotaPerCookie, user.Quota)
}

func TestFestivalStartsAtMidnightAndUsesPublishedProbabilities(t *testing.T) {
	user := setupFestivalTest(t)
	require.NoError(t, creditFestivalQuota(DB, "topup", 1, user.Id, 500*festivalQuotaPerCookie, festivalStart))
	festivalNow = func() time.Time { return time.Unix(festivalStart-1, 0) }
	_, err := DrawFestival(user.Id, "festival-before-start")
	require.ErrorContains(t, err, "not started")
	festivalNow = func() time.Time { return time.Unix(festivalStart, 0) }
	_, err = DrawFestival(user.Id, "festival-at-start-01")
	require.NoError(t, err)
	for _, test := range []struct{ first, last, cookies int }{
		{0, 5499, 50}, {5500, 8999, 100}, {9000, 9499, 200},
		{9500, 9749, 300}, {9750, 9899, 500}, {9900, 9999, 1000},
	} {
		for _, ticket := range []int{test.first, test.last} {
			prize, err := festivalPrizeForTicket(ticket)
			require.NoError(t, err)
			assert.Equal(t, test.cookies, prize.Cookies)
		}
	}
	_, err = festivalPrizeForTicket(10000)
	require.Error(t, err)
	// A rolled back credited source must leave no eligible activity progress.
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := creditFestivalQuota(tx, "redemption", 9, user.Id, 999, festivalStart); err != nil {
			return err
		}
		return gorm.ErrInvalidTransaction
	})
	require.ErrorIs(t, err, gorm.ErrInvalidTransaction)
	status, err := GetFestivalStatus(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(500), status.CreditedCookies)
}
