package model

import (
	"errors"
	"fmt"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/shopspring/decimal"

	"gorm.io/gorm"
)

type Redemption struct {
	Id                    int            `json:"id"`
	UserId                int            `json:"user_id"`
	Key                   string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status                int            `json:"status" gorm:"default:1"`
	Name                  string         `json:"name" gorm:"index"`
	Quota                 int            `json:"quota"`
	SubscriptionPlanId    int            `json:"subscription_plan_id" gorm:"default:0"`
	SubscriptionPlanTitle string         `json:"subscription_plan_title" gorm:"type:varchar(128);default:''"`
	SubscriptionPrice     float64        `json:"subscription_price" gorm:"default:0"`
	CreatedTime           int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime          int64          `json:"redeemed_time" gorm:"bigint"`
	Count                 int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId            int            `json:"used_user_id"`
	DeletedAt             gorm.DeletedAt `gorm:"index"`
	ExpiredTime           int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
	RewardInviterId       int            `json:"reward_inviter_id" gorm:"default:0"`
	RewardQuota           int            `json:"reward_quota" gorm:"default:0"`
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, status string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

type RedemptionResult struct {
	Quota                 int    `json:"quota"`
	SubscriptionId        int    `json:"subscription_id,omitempty"`
	SubscriptionPlanTitle string `json:"subscription_plan_title,omitempty"`
}

// Snapshot the plan's price when issuing a code; later price changes must not
// alter its contribution to the event or invitation rewards.
func (redemption *Redemption) SetSubscriptionPlan(planId int) error {
	if planId < 0 {
		return errors.New("请选择有效的订阅套餐")
	}
	if planId == 0 {
		redemption.SubscriptionPlanId = 0
		redemption.SubscriptionPlanTitle = ""
		redemption.SubscriptionPrice = 0
		return nil
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil || !plan.Enabled {
		return errors.New("订阅套餐不存在或未启用")
	}
	if plan.PriceAmount < 0 || math.IsNaN(plan.PriceAmount) || math.IsInf(plan.PriceAmount, 0) {
		return errors.New("订阅套餐价格无效")
	}
	redemption.SubscriptionPlanId = plan.Id
	redemption.SubscriptionPlanTitle = plan.Title
	redemption.SubscriptionPrice = plan.PriceAmount
	redemption.Quota = 0
	return nil
}

func Redeem(key string, userId int) (*RedemptionResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	redeemed := &RedemptionResult{}
	groupChanged := false

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may credit quota, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		result := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]interface{}{
				"redeemed_time": common.GetTimestamp(),
				"status":        common.RedemptionCodeStatusUsed,
				"used_user_id":  userId,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("该兑换码已被使用")
		}
		if redemption.SubscriptionPlanId > 0 {
			// Issued codes remain valid when a plan is delisted, as with paid orders.
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if err != nil {
				return err
			}
			// Serialize this user's purchases so separate codes cannot bypass the plan limit.
			var user User
			if err := lockForUpdate(tx).Select("id").First(&user, userId).Error; err != nil {
				return err
			}
			subscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			redeemed.SubscriptionId = subscription.Id
			redeemed.SubscriptionPlanTitle = plan.Title
			groupChanged = subscription.PrevUserGroup != ""
			quota, err := subscriptionInvitationQuota(&SubscriptionOrder{Money: redemption.SubscriptionPrice})
			if err != nil {
				return err
			}
			if err := creditInvitationReward(tx, redemption, userId, quota); err != nil {
				return err
			}
			return creditBakingCookies(tx, userId, fmt.Sprintf("redemption:%d", redemption.Id), decimal.NewFromFloat(redemption.SubscriptionPrice).Mul(decimal.NewFromInt(10)), bakingNow())
		}
		if err := creditUserQuota(tx, userId, redemption.Quota, nil); err != nil {
			return err
		}
		if err := creditInvitationReward(tx, redemption, userId, redemption.Quota); err != nil {
			return err
		}
		redeemed.Quota = redemption.Quota
		return creditBakingQuota(tx, userId, fmt.Sprintf("redemption:%d", redemption.Id), redemption.Quota)
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if redeemed.SubscriptionId > 0 {
		if groupChanged {
			refreshSubscriptionUserGroupCache(userId, "subscription redemption")
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码开通订阅，套餐: %s，兑换码ID %d", redeemed.SubscriptionPlanTitle, redemption.Id))
		return redeemed, nil
	}
	syncCreditUserQuotaCache(userId, redemption.Quota, "redemption")
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return redeemed, nil
}

func (redemption *Redemption) Insert() error {
	if redemption.SubscriptionPlanId == 0 && redemption.Quota == 0 {
		redemption.Quota = 100
	}
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	result := DB.Model(redemption).Where("status <> ?", common.RedemptionCodeStatusUsed).
		Select("name", "status", "quota", "expired_time", "subscription_plan_id", "subscription_plan_title", "subscription_price").Updates(redemption)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("兑换码已使用或已发生变更，请刷新后重试")
	}
	return nil
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
