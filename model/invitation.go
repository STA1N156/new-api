package model

import (
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const InviteTopUpRewardPercent = 8

// Settlement must lock and consume the source order/code in this transaction.
// source stores reward_inviter_id and reward_quota for the credited reward.
func creditInvitationReward(tx *gorm.DB, source interface{}, userId int, creditedQuota int) error {
	if creditedQuota <= 0 || !operation_setting.IsPaymentComplianceConfirmed() {
		return nil
	}
	// Split the whole and remainder to floor the percentage without overflow.
	quota := int64(creditedQuota)
	reward := quota/100*InviteTopUpRewardPercent + quota%100*InviteTopUpRewardPercent/100
	if reward == 0 {
		return nil
	}
	var invitee User
	if err := tx.Select("inviter_id").First(&invitee, userId).Error; err != nil {
		return err
	}
	if invitee.InviterId == 0 || invitee.InviterId == userId {
		return nil
	}
	result := tx.Model(&User{}).
		Where("id = ? AND aff_quota <= ? AND aff_history <= ? AND aff_topup_quota <= ?",
			invitee.InviterId, math.MaxInt64-reward, math.MaxInt64-reward, math.MaxInt64-reward).
		Updates(map[string]interface{}{
			"aff_quota":       gorm.Expr("aff_quota + ?", reward),
			"aff_history":     gorm.Expr("aff_history + ?", reward),
			"aff_topup_quota": gorm.Expr("aff_topup_quota + ?", reward),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := tx.Model(&User{}).Where("id = ?", invitee.InviterId).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 { // Removed inviters must not prevent the invitee from topping up.
			return nil
		}
		return errors.New("invitation reward limit exceeded")
	}
	return tx.Model(source).Updates(map[string]interface{}{
		"reward_inviter_id": invitee.InviterId,
		"reward_quota":      reward,
	}).Error
}

// Convert the saved payment amount to quota using the configured recharge price;
// display exchange rates, cycle allowances and later plan edits are irrelevant.
func subscriptionInvitationQuota(order *SubscriptionOrder) (int, error) {
	if order.PaymentProvider == PaymentProviderBalance || order.PaymentMethod == PaymentMethodBalance ||
		order.Money <= 0 || !operation_setting.IsPaymentComplianceConfirmed() {
		return 0, nil
	}
	for _, value := range []float64{order.Money, operation_setting.Price, common.QuotaPerUnit} {
		if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
			return 0, errors.New("invalid subscription reward conversion")
		}
	}
	quota := decimal.NewFromFloat(order.Money).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Div(decimal.NewFromFloat(operation_setting.Price)).Floor()
	return common.QuotaFromDecimalStrict(quota)
}

// Count the relationship itself: old registrations with a zero signup reward
// did not increment aff_count. Deleted invitees still count as past invitations.
func CountInvitedUsers(userId int) (int64, error) {
	var count int64
	err := DB.Unscoped().Model(&User{}).Where("inviter_id = ? AND id <> ?", userId, userId).Count(&count).Error
	return count, err
}
