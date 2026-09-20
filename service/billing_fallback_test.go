package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBillingSubscriptionFallback(t *testing.T) {
	for _, tc := range []struct {
		name          string
		preference    string
		primaryLeft   int64
		cycleLeft     int64
		wallet        int
		token         int
		wantSource    string
		wantErrorCode types.ErrorCode
		allowedModels model.SubscriptionModels
	}{
		{name: "short cycle has 3 but request needs 4", preference: "subscription_first", primaryLeft: 200, cycleLeft: 3, wallet: 20, token: 20, wantSource: BillingSourceWallet},
		{name: "short cycle exhausted", preference: "subscription_first", primaryLeft: 200, cycleLeft: 0, wallet: 20, token: 20, wantSource: BillingSourceWallet},
		{name: "primary quota insufficient", preference: "subscription_first", primaryLeft: 3, cycleLeft: 50, wallet: 20, token: 20, wantSource: BillingSourceWallet},
		{name: "subscription exactly covers request", preference: "subscription_first", primaryLeft: 200, cycleLeft: 4, wallet: 20, token: 20, wantSource: BillingSourceSubscription},
		{name: "subscription only does not charge wallet", preference: "subscription_only", primaryLeft: 200, cycleLeft: 3, wallet: 20, token: 20, wantErrorCode: types.ErrorCodeInsufficientUserQuota},
		{name: "neither source covers request", preference: "subscription_first", primaryLeft: 200, cycleLeft: 3, wallet: 3, token: 20, wantErrorCode: types.ErrorCodeInsufficientUserQuota},
		{name: "allowed model uses subscription", preference: "subscription_first", primaryLeft: 200, cycleLeft: 50, wallet: 20, token: 20, allowedModels: model.SubscriptionModels{"public-model"}, wantSource: BillingSourceSubscription},
		{name: "unselected model falls back to wallet", preference: "subscription_first", primaryLeft: 200, cycleLeft: 50, wallet: 20, token: 20, allowedModels: model.SubscriptionModels{"upstream-model"}, wantSource: BillingSourceWallet},
		{name: "subscription only rejects unselected model", preference: "subscription_only", primaryLeft: 200, cycleLeft: 50, wallet: 20, token: 20, allowedModels: model.SubscriptionModels{"upstream-model"}, wantErrorCode: types.ErrorCodeInsufficientUserQuota},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}))
			previousDB, previousType := model.DB, common.MainDatabaseType()
			previousRedis, previousBatch := common.RedisEnabled, common.BatchUpdateEnabled
			model.DB = db
			common.SetMainDatabaseType(common.DatabaseTypeSQLite)
			common.RedisEnabled, common.BatchUpdateEnabled = false, false
			t.Cleanup(func() {
				model.InvalidateSubscriptionPlanCache(1)
				model.DB = previousDB
				common.SetMainDatabaseType(previousType)
				common.RedisEnabled, common.BatchUpdateEnabled = previousRedis, previousBatch
				require.NoError(t, sqlDB.Close())
			})
			user := model.User{Id: 1, Username: "billing-user", Quota: tc.wallet}
			token := model.Token{Id: 1, UserId: user.Id, Key: "billing-token", RemainQuota: tc.token}
			plan := model.SubscriptionPlan{Id: 1, Title: "Weekly and five-hour", QuotaResetPeriod: model.SubscriptionResetNever}
			plan.AllowedModels = tc.allowedModels
			now := common.GetTimestamp()
			sub := model.UserSubscription{
				UserId: user.Id, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 28*86400,
				AmountTotal: 300, AmountUsed: 300 - tc.primaryLeft,
				QuotaLimits:         model.SubscriptionQuotaLimits{{PeriodSeconds: 18000, AmountTotal: 50, AmountUsed: 50 - tc.cycleLeft, LastResetTime: now}},
				AllowWalletOverflow: false, // Existing multi-cycle subscriptions were forced to false.
			}
			require.NoError(t, db.Create(&user).Error)
			require.NoError(t, db.Create(&token).Error)
			require.NoError(t, db.Create(&plan).Error)
			require.NoError(t, db.Create(&sub).Error)
			model.InvalidateSubscriptionPlanCache(plan.Id)
			info := &relaycommon.RelayInfo{
				RequestId: "fallback-request", UserId: user.Id, TokenId: token.Id, TokenKey: token.Key, ForcePreConsume: true,
				OriginModelName: "public-model",
			}
			info.UserSetting.BillingPreference = tc.preference
			ctx, _ := gin.CreateTestContext(nil)
			session, apiErr := NewBillingSession(ctx, info, 4)
			charged := 0
			if tc.wantErrorCode != "" {
				require.NotNil(t, apiErr)
				assert.Equal(t, tc.wantErrorCode, apiErr.GetErrorCode())
				require.Nil(t, session)
			} else {
				require.Nil(t, apiErr)
				require.NotNil(t, session)
				assert.Equal(t, tc.wantSource, info.BillingSource)
				assert.Equal(t, 4, session.GetPreConsumedQuota())
				var reservedToken model.Token
				require.NoError(t, db.First(&reservedToken, token.Id).Error)
				assert.Equal(t, tc.token-4, reservedToken.RemainQuota, "fallback must not reserve token quota twice")
				require.NoError(t, session.Settle(2))
				charged = 2
			}
			var storedUser model.User
			var storedToken model.Token
			var storedSub model.UserSubscription
			require.NoError(t, db.First(&storedUser, user.Id).Error)
			require.NoError(t, db.First(&storedToken, token.Id).Error)
			require.NoError(t, db.First(&storedSub, sub.Id).Error)
			walletCharge, subscriptionCharge := 0, int64(0)
			if tc.wantSource == BillingSourceWallet {
				walletCharge = charged
			} else if tc.wantSource == BillingSourceSubscription {
				subscriptionCharge = int64(charged)
			}
			assert.Equal(t, tc.wallet-walletCharge, storedUser.Quota)
			assert.Equal(t, tc.token-charged, storedToken.RemainQuota)
			assert.Equal(t, charged, storedToken.UsedQuota)
			assert.Equal(t, sub.AmountUsed+subscriptionCharge, storedSub.AmountUsed)
			assert.Equal(t, sub.QuotaLimits[0].AmountUsed+subscriptionCharge, storedSub.QuotaLimits[0].AmountUsed)
			var records int64
			require.NoError(t, db.Model(&model.SubscriptionPreConsumeRecord{}).Count(&records).Error)
			if tc.wantSource == BillingSourceSubscription {
				assert.EqualValues(t, 1, records)
			} else {
				assert.Zero(t, records, "a failed subscription reservation must leave no charge record")
			}
		})
	}
}
