package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSearchRedemptionsFiltersAndPaginates(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	})

	now := common.GetTimestamp()
	redemptions := []Redemption{
		{Id: 1, Name: "alpha-active", Key: "00000000000000000000000000000001", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: 0},
		{Id: 2, Name: "alpha-future", Key: "00000000000000000000000000000002", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now + 3600},
		{Id: 3, Name: "alpha-expired", Key: "00000000000000000000000000000003", Status: common.RedemptionCodeStatusEnabled, ExpiredTime: now - 10},
		{Id: 4, Name: "beta-disabled", Key: "00000000000000000000000000000004", Status: common.RedemptionCodeStatusDisabled, ExpiredTime: 0},
		{Id: 5, Name: "beta-used", Key: "00000000000000000000000000000005", Status: common.RedemptionCodeStatusUsed, ExpiredTime: 0},
	}
	require.NoError(t, DB.Create(&redemptions).Error)

	tests := []struct {
		name      string
		keyword   string
		status    string
		startIdx  int
		num       int
		wantTotal int64
		wantIds   []int
	}{
		{
			name:      "no filters returns all rows",
			num:       10,
			wantTotal: 5,
			wantIds:   []int{5, 4, 3, 2, 1},
		},
		{
			name:      "keyword filters by name prefix",
			keyword:   "alpha",
			num:       10,
			wantTotal: 3,
			wantIds:   []int{3, 2, 1},
		},
		{
			name:      "enabled status excludes expired rows",
			status:    "1",
			num:       10,
			wantTotal: 2,
			wantIds:   []int{2, 1},
		},
		{
			name:      "expired status returns enabled expired rows",
			status:    "expired",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{3},
		},
		{
			name:      "disabled status",
			status:    "2",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{4},
		},
		{
			name:      "used status",
			status:    "3",
			num:       10,
			wantTotal: 1,
			wantIds:   []int{5},
		},
		{
			name:      "pagination keeps unpaged total",
			startIdx:  1,
			num:       2,
			wantTotal: 5,
			wantIds:   []int{4, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rows, total, err := SearchRedemptions(tt.keyword, tt.status, tt.startIdx, tt.num)
			require.NoError(t, err)
			assert.Equal(t, tt.wantTotal, total)
			gotIds := make([]int, 0, len(rows))
			for _, row := range rows {
				gotIds = append(gotIds, row.Id)
			}
			assert.Equal(t, tt.wantIds, gotIds)
		})
	}
}

func setupRedeemFixture(t *testing.T, quota int) (userId int, key string) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}).Error)
		DB.Exec("DELETE FROM users")
		DB.Exec("DELETE FROM logs")
	})

	user := &User{Username: "redeem-user", Password: "password", Status: common.UserStatusEnabled, Quota: 0}
	require.NoError(t, DB.Create(user).Error)

	key = "10000000000000000000000000000001"
	redemption := &Redemption{
		Name:        "redeem-test",
		Key:         key,
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       quota,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)
	return user.Id, key
}

func TestRedeemCreditsQuotaExactlyOnce(t *testing.T) {
	userId, key := setupRedeemFixture(t, 500)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	assert.Equal(t, 500, result.Quota)

	var user User
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 500, user.Quota)

	var redemption Redemption
	require.NoError(t, DB.First(&redemption, "name = ?", "redeem-test").Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redemption.Status)
	assert.Equal(t, userId, redemption.UsedUserId)

	// Redeeming the same code again must fail and must not credit quota.
	_, err = Redeem(key, userId)
	require.Error(t, err)
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 500, user.Quota)
}

// Exactly one of several concurrent redeems of the same code may win, and
// quota must be credited exactly once.
func TestRedeemConcurrentSingleSuccess(t *testing.T) {
	userId, key := setupRedeemFixture(t, 300)

	const goroutines = 5
	successes := make([]bool, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			defer wg.Done()
			if _, err := Redeem(key, userId); err == nil {
				successes[idx] = true
			}
		}(i)
	}
	wg.Wait()

	successCount := 0
	for _, ok := range successes {
		if ok {
			successCount++
		}
	}
	assert.Equal(t, 1, successCount, "exactly one concurrent redeem should succeed")

	var user User
	require.NoError(t, DB.First(&user, "id = ?", userId).Error)
	assert.Equal(t, 300, user.Quota, "quota must be credited exactly once")
}

func TestRedeemSubscriptionUsesSavedPriceAndCreditsBenefitsOnce(t *testing.T) {
	inviter, user := setupInvitationTest(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	oldPrice, oldNow := operation_setting.Price, bakingNow
	operation_setting.Price = 1
	bakingNow = func() time.Time { return bakingStart.Add(time.Hour) }
	t.Cleanup(func() { operation_setting.Price = oldPrice; bakingNow = oldNow })
	plan := SubscriptionPlan{
		Title: "兑换周卡", Enabled: true, PriceAmount: 10,
		DurationUnit: "day", DurationValue: 7, TotalAmount: 500000,
		QuotaResetPeriod: "daily", MaxPurchasePerUser: 1,
		QuotaLimits: SubscriptionQuotaLimits{{PeriodSeconds: 3600, AmountTotal: 100000}},
	}
	require.NoError(t, DB.Create(&plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	t.Cleanup(func() { InvalidateSubscriptionPlanCache(plan.Id) })
	code := Redemption{Key: "subscription-redemption-once", Name: "周卡"}
	require.NoError(t, code.SetSubscriptionPlan(plan.Id))
	require.NoError(t, code.Insert())
	t.Cleanup(func() { DB.Unscoped().Delete(&code) })
	// Already issued codes retain their value even when the plan is repriced or delisted.
	require.NoError(t, DB.Model(&plan).Updates(map[string]interface{}{"price_amount": 99, "enabled": false}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	result, err := Redeem(code.Key, user.Id)
	require.NoError(t, err)
	assert.Zero(t, result.Quota)
	assert.Equal(t, plan.Title, result.SubscriptionPlanTitle)
	var sub UserSubscription
	require.NoError(t, DB.First(&sub, result.SubscriptionId).Error)
	assert.Equal(t, "redemption", sub.Source)
	assert.Equal(t, "active", sub.Status)
	assert.EqualValues(t, 7*86400, sub.EndTime-sub.StartTime)
	assert.Equal(t, plan.TotalAmount, sub.AmountTotal)
	require.Len(t, sub.QuotaLimits, 1)
	assert.EqualValues(t, 100000, sub.QuotaLimits[0].AmountTotal)
	_, err = Redeem(code.Key, user.Id)
	require.Error(t, err)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Zero(t, user.Quota)
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 400000, inviter.AffTopUpQuota)
	state, err := GetBakingState(user.Id)
	require.NoError(t, err)
	assert.Equal(t, float64(100), state.CreditedCookies)
	require.NoError(t, DB.First(&code, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, code.Status)
	assert.Zero(t, code.Quota)
	assert.Equal(t, float64(10), code.SubscriptionPrice)
	code.Status = common.RedemptionCodeStatusEnabled
	assert.Error(t, code.Update(), "used codes cannot be re-enabled")
	start := code.RedeemedTime - code.RedeemedTime%3600
	rows, err := getStatisticsBuckets(start, start+3600, 3600, []StatisticsHour{{Timestamp: start}})
	require.NoError(t, err)
	assert.Equal(t, float64(10), rows[0].RedemptionTopup)
	assert.Zero(t, rows[0].SubscriptionTopup)
	assert.EqualValues(t, 1, rows[0].RedeemedCount)
}

func TestRedeemSubscriptionRollsBackOnFailureAndEnforcesPurchaseLimit(t *testing.T) {
	_, user := setupInvitationTest(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	oldPrice := operation_setting.Price
	operation_setting.Price = 0
	t.Cleanup(func() { operation_setting.Price = oldPrice })
	plan := SubscriptionPlan{Title: "限购月卡", Enabled: true, PriceAmount: 10, DurationUnit: "month", DurationValue: 1, MaxPurchasePerUser: 1}
	require.NoError(t, DB.Create(&plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	t.Cleanup(func() { InvalidateSubscriptionPlanCache(plan.Id) })
	code := Redemption{Key: "subscription-redemption-rollback", Name: "月卡"}
	require.NoError(t, code.SetSubscriptionPlan(plan.Id))
	require.NoError(t, code.Insert())
	t.Cleanup(func() { DB.Unscoped().Where("subscription_plan_id = ?", plan.Id).Delete(&Redemption{}) })
	_, err := Redeem(code.Key, user.Id)
	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.Zero(t, count)
	require.NoError(t, DB.First(&code, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
	assert.Zero(t, code.RedeemedTime)
	operation_setting.Price = 1
	_, err = Redeem(code.Key, user.Id)
	require.NoError(t, err)
	code.Id = 0
	code.Key = "subscription-redemption-limit"
	require.NoError(t, code.Insert())
	_, err = Redeem(code.Key, user.Id)
	require.Error(t, err)
	require.NoError(t, DB.First(&code, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
