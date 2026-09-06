package model

import (
	"math"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupInvitationTest(t *testing.T) (User, User) {
	t.Helper()
	setupUserUpdateTestState(t)
	setting := operation_setting.GetPaymentSetting()
	oldSetting := *setting
	oldQuotaPerUnit := common.QuotaPerUnit
	setting.ComplianceConfirmed = true
	setting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.QuotaPerUnit = 500000
	t.Cleanup(func() {
		*setting = oldSetting
		common.QuotaPerUnit = oldQuotaPerUnit
	})
	inviter := User{Username: "inviter", AffCode: "sender", Status: common.UserStatusEnabled, AffQuota: 700, AffHistoryQuota: 1000}
	require.NoError(t, DB.Create(&inviter).Error)
	invitee := User{Username: "invitee", AffCode: "friend", Status: common.UserStatusEnabled, InviterId: inviter.Id}
	require.NoError(t, DB.Create(&invitee).Error)
	return inviter, invitee
}

func TestInvitationPaidTopUpCreditsEightPercentOnce(t *testing.T) {
	tests := []struct {
		name, provider string
		amount         int64
		settle         func(string) error
	}{
		{"epay", PaymentProviderEpay, 2, func(s string) error { _, err := RechargeEpay(s, "alipay", ""); return err }},
		{"stripe", PaymentProviderStripe, 999, func(s string) error { return Recharge(s, "", "") }},
		{"creem", PaymentProviderCreem, 1000000, func(s string) error { return RechargeCreem(s, "", "", "") }},
		{"waffo", PaymentProviderWaffo, 2, func(s string) error { return RechargeWaffo(s, "") }},
		{"pancake", PaymentProviderWaffoPancake, 2, RechargeWaffoPancake},
		{"manual", PaymentProviderEpay, 2, func(s string) error { return ManualCompleteTopUp(s, "") }},
		{"manual_creem", PaymentProviderCreem, 1000000, func(s string) error { return ManualCompleteTopUp(s, "") }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inviter, invitee := setupInvitationTest(t)
			order := TopUp{UserId: invitee.Id, TradeNo: tt.name, Amount: tt.amount, Money: 2, PaymentProvider: tt.provider, Status: common.TopUpStatusPending}
			require.NoError(t, order.Insert())
			require.NoError(t, tt.settle(order.TradeNo))
			_ = tt.settle(order.TradeNo) // Providers may acknowledge or reject duplicate callbacks.
			require.NoError(t, ManualCompleteTopUp(order.TradeNo, ""))
			require.NoError(t, DB.First(&inviter, inviter.Id).Error)
			require.NoError(t, DB.First(&invitee, invitee.Id).Error)
			assert.Equal(t, 1000000, invitee.Quota, "the invitee keeps the full paid credit")
			assert.EqualValues(t, 80700, inviter.AffQuota)
			assert.EqualValues(t, 81000, inviter.AffHistoryQuota)
			assert.EqualValues(t, 80000, inviter.AffTopUpQuota)
			savedOrder := GetTopUpByTradeNo(order.TradeNo)
			require.NotNil(t, savedOrder)
			assert.Equal(t, inviter.Id, savedOrder.RewardInviterId)
			assert.Equal(t, 80000, savedOrder.RewardQuota)
			assert.Equal(t, 0, inviter.Quota, "commission must remain available for transfer")
		})
	}
}

func TestInvitationFailedCreditRollsBackRewardAndOrder(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	require.NoError(t, DB.Model(&invitee).Update("quota", common.MaxQuota-1).Error)
	order := TopUp{UserId: invitee.Id, TradeNo: "overflow", Amount: 2, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.Error(t, ManualCompleteTopUp(order.TradeNo, ""))
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 700, inviter.AffQuota)
	assert.EqualValues(t, 0, inviter.AffTopUpQuota)
	assert.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo(order.TradeNo).Status)
}

func TestInvitationIneligibleTopUpKeepsFullInviteeCredit(t *testing.T) {
	for _, reason := range []string{"no_inviter", "self_invite", "deleted_inviter", "compliance_disabled"} {
		t.Run(reason, func(t *testing.T) {
			inviter, invitee := setupInvitationTest(t)
			switch reason {
			case "no_inviter":
				require.NoError(t, DB.Model(&invitee).Update("inviter_id", 0).Error)
			case "self_invite":
				require.NoError(t, DB.Model(&invitee).Update("inviter_id", invitee.Id).Error)
			case "deleted_inviter":
				require.NoError(t, DB.Delete(&inviter).Error)
			case "compliance_disabled":
				operation_setting.GetPaymentSetting().ComplianceConfirmed = false
			}
			order := TopUp{UserId: invitee.Id, TradeNo: reason, Amount: 2, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
			require.NoError(t, order.Insert())
			require.NoError(t, ManualCompleteTopUp(order.TradeNo, ""))
			require.NoError(t, DB.First(&invitee, invitee.Id).Error)
			require.NoError(t, DB.Unscoped().First(&inviter, inviter.Id).Error)
			assert.Equal(t, 1000000, invitee.Quota)
			assert.EqualValues(t, 700, inviter.AffQuota)
			assert.Zero(t, GetTopUpByTradeNo(order.TradeNo).RewardQuota)
		})
	}
}

func TestInvitationSmallCreditRoundsDownInRawUnits(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	for _, tc := range []struct{ amount, reward int64 }{{12, 0}, {13, 1}, {24, 1}, {25, 2}, {99, 7}, {100, 8}, {101, 8}} {
		order := TopUp{UserId: invitee.Id, TradeNo: "small-" + strconv.FormatInt(tc.amount, 10), Amount: tc.amount, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
		require.NoError(t, order.Insert())
		require.NoError(t, RechargeCreem(order.TradeNo, "", "", ""))
		assert.EqualValues(t, tc.reward, GetTopUpByTradeNo(order.TradeNo).RewardQuota)
	}
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 727, inviter.AffQuota)
	assert.EqualValues(t, 27, inviter.AffTopUpQuota)
}

func TestInvitationTransferPreservesIncomeAndDoesNotCreateCommission(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	require.NoError(t, DB.Model(&invitee).Updates(map[string]interface{}{"aff_quota": 1000000, "aff_history": 1200000, "aff_topup_quota": 900000}).Error)
	require.NoError(t, invitee.TransferAffQuotaToQuota(500000))
	require.NoError(t, DB.First(&invitee, invitee.Id).Error)
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 500000, invitee.AffQuota)
	assert.Equal(t, 500000, invitee.Quota)
	assert.EqualValues(t, 1200000, invitee.AffHistoryQuota)
	assert.EqualValues(t, 900000, invitee.AffTopUpQuota)
	assert.EqualValues(t, 700, inviter.AffQuota)
}

func TestInvitationCountIncludesLegacyZeroRewardSignups(t *testing.T) {
	inviter, _ := setupInvitationTest(t)
	assert.Zero(t, inviter.AffCount)
	count, err := CountInvitedUsers(inviter.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
}

func TestInvitationRewardFailureRollsBackPaidCredit(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	require.NoError(t, DB.Model(&inviter).Update("aff_history", int64(math.MaxInt64)).Error)
	order := TopUp{UserId: invitee.Id, TradeNo: "reward-overflow", Amount: 2, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.Error(t, ManualCompleteTopUp(order.TradeNo, ""))
	require.NoError(t, DB.First(&invitee, invitee.Id).Error)
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.Zero(t, invitee.Quota)
	assert.EqualValues(t, 700, inviter.AffQuota)
	assert.Zero(t, inviter.AffTopUpQuota)
	assert.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo(order.TradeNo).Status)
}

func TestInvitationLargeCreditDoesNotOverflowPercentage(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	order := TopUp{UserId: invitee.Id, TradeNo: "large-credit", Amount: 2000000000000000000, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	require.NoError(t, ManualCompleteTopUp(order.TradeNo, ""))
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.EqualValues(t, 160000000000000000, inviter.AffTopUpQuota)
}

func TestInvitationPreviouslyCompletedFivePercentRewardIsNotRecalculated(t *testing.T) {
	inviter, invitee := setupInvitationTest(t)
	require.NoError(t, DB.Model(&inviter).Updates(map[string]interface{}{"aff_quota": 50700, "aff_history": 51000, "aff_topup_quota": 50000}).Error)
	require.NoError(t, DB.Model(&invitee).Update("quota", 1000000).Error)
	order := TopUp{UserId: invitee.Id, TradeNo: "legacy-five-percent", Amount: 2, PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusSuccess, RewardInviterId: inviter.Id, RewardQuota: 50000}
	require.NoError(t, order.Insert())
	require.NoError(t, ManualCompleteTopUp(order.TradeNo, ""))
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	require.NoError(t, DB.First(&invitee, invitee.Id).Error)
	assert.EqualValues(t, 50700, inviter.AffQuota)
	assert.EqualValues(t, 51000, inviter.AffHistoryQuota)
	assert.EqualValues(t, 50000, inviter.AffTopUpQuota)
	assert.Equal(t, 1000000, invitee.Quota)
	assert.Equal(t, 50000, GetTopUpByTradeNo(order.TradeNo).RewardQuota)
}

func TestInvitationTransferRejectsWalletOverflow(t *testing.T) {
	inviter, _ := setupInvitationTest(t)
	require.NoError(t, DB.Model(&inviter).Updates(map[string]interface{}{"quota": common.MaxQuota - 100, "aff_quota": 500000}).Error)
	require.Error(t, inviter.TransferAffQuotaToQuota(500000))
	require.NoError(t, DB.First(&inviter, inviter.Id).Error)
	assert.Equal(t, common.MaxQuota-100, inviter.Quota)
	assert.EqualValues(t, 500000, inviter.AffQuota)
}
