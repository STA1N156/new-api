package model

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"math/big"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const bakingEvent = "double-eleven-2026"
const bakingMicros = int64(1_000_000)
const BakingMinDuration = int64(2000)
const BakingMaxDuration = int64(4000)

var bakingNow = time.Now
var bakingZone = time.FixedZone("Asia/Hong_Kong", 8*60*60)
var bakingStart = time.Date(2026, 11, 6, 0, 0, 0, 0, bakingZone)
var bakingEnd = time.Date(2026, 11, 13, 0, 0, 0, 0, bakingZone)
var bakingRewards = []int{10, 20, 40, 60, 100, 200, 1111}
var bakingChances = []int{80, 65, 50, 35, 20, 5}

var ErrBakingClosed = errors.New("Baking event is not active")
var ErrBakingChanged = errors.New("Baking state changed. Please refresh")
var ErrBakingNoMaterial = errors.New("No baking ingredients available")

type BakingAccount struct {
	ID             int64  `json:"-"`
	Event          string `json:"-" gorm:"type:varchar(32);uniqueIndex:idx_baking_account"`
	UserID         int    `json:"-" gorm:"uniqueIndex:idx_baking_account"`
	CreditedMicros int64  `json:"-"`
	Used           int    `json:"used"`
	ClaimedCookies int    `json:"claimed_cookies"`
	BestLevel      int    `json:"best_level"`
	ActiveRoundID  int64  `json:"-"`
}

type BakingContribution struct {
	ID        int64
	Event     string `gorm:"type:varchar(32);uniqueIndex:idx_baking_source;index:idx_baking_credit_user"`
	Source    string `gorm:"type:varchar(80);uniqueIndex:idx_baking_source"`
	UserID    int    `gorm:"index:idx_baking_credit_user"`
	Micros    int64
	CreatedAt int64
}

type BakingRound struct {
	ID             int64  `json:"id"`
	Event          string `json:"-" gorm:"type:varchar(32);index:idx_baking_round_user"`
	UserID         int    `json:"-" gorm:"index:idx_baking_round_user"`
	Serial         int    `json:"serial"`
	Level          int    `json:"level"`
	Status         string `json:"status" gorm:"type:varchar(16)"`
	Version        int    `json:"version"`
	PendingSuccess bool   `json:"-"`
	ReadyAt        int64  `json:"ready_at"`
	QuotaPerCookie string `json:"-" gorm:"type:varchar(64)"`
	ClaimedCookies int    `json:"claimed_cookies"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"-"`
}

type BakingMilestone struct {
	Cookies int `json:"cookies"`
	Grants  int `json:"grants"`
}

var bakingMilestones = []BakingMilestone{{500, 3}, {1000, 5}, {2000, 8}, {3000, 8}, {4000, 8}, {5000, 8}, {6000, 10}, {7000, 10}}

type BakingState struct {
	BakingAccount
	ServerTime      int64             `json:"server_time"`
	StartsAt        int64             `json:"starts_at"`
	EndsAt          int64             `json:"ends_at"`
	Phase           string            `json:"phase"`
	CreditedCookies float64           `json:"credited_cookies"`
	Granted         int               `json:"granted"`
	Available       int               `json:"available"`
	Milestones      []BakingMilestone `json:"milestones"`
	Rewards         []int             `json:"rewards"`
	Chances         []int             `json:"chances"`
	Round           *BakingRound      `json:"round"`
	History         []BakingRound     `json:"history"`
}

type BakingCommand struct {
	RoundID int64 `json:"round_id"`
	Version int   `json:"version"`
}

func bakingActive(now time.Time) bool {
	return !now.Before(bakingStart) && now.Before(bakingEnd)
}

func bakingGranted(micros int64) int {
	granted := 0
	for _, milestone := range bakingMilestones {
		if micros >= int64(milestone.Cookies)*bakingMicros {
			granted += milestone.Grants
		}
	}
	return granted
}

func bakingCurrencyRate() (decimal.Decimal, error) {
	rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) || common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		return decimal.Zero, errors.New("Invalid baking currency configuration")
	}
	return decimal.NewFromFloat(rate), nil
}

func ensureBakingAccount(tx *gorm.DB, userID int) (*BakingAccount, error) {
	account := BakingAccount{Event: bakingEvent, UserID: userID}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account).Error; err != nil {
		return nil, err
	}
	if err := tx.Where("event = ? AND user_id = ?", bakingEvent, userID).First(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

// Called only inside a successful settlement transaction, after the user's
// quota write/row lock. The source key makes repeated settlement hooks harmless.
func creditBakingCookies(tx *gorm.DB, userID int, source string, cookies decimal.Decimal, now time.Time) error {
	if !bakingActive(now) || !cookies.IsPositive() {
		return nil
	}
	var count int64
	if err := tx.Model(&BakingContribution{}).Where("event = ? AND source = ?", bakingEvent, source).Count(&count).Error; err != nil || count > 0 {
		return err
	}
	micros, err := common.QuotaFromDecimalStrict(cookies.Mul(decimal.NewFromInt(bakingMicros)).Floor())
	if err != nil || micros == 0 {
		return err
	}
	account, err := ensureBakingAccount(tx, userID)
	if err != nil {
		return err
	}
	if int64(micros) > math.MaxInt64-account.CreditedMicros {
		return errors.New("Baking progress limit exceeded")
	}
	contribution := BakingContribution{Event: bakingEvent, Source: source, UserID: userID, Micros: int64(micros), CreatedAt: now.Unix()}
	if err := tx.Create(&contribution).Error; err != nil {
		return err
	}
	return tx.Model(account).UpdateColumn("credited_micros", gorm.Expr("credited_micros + ?", micros)).Error
}

func creditBakingQuota(tx *gorm.DB, userID int, source string, quota int) error {
	now := bakingNow()
	if !bakingActive(now) || quota <= 0 {
		return nil
	}
	rate, err := bakingCurrencyRate()
	if err != nil {
		return err
	}
	cookies := decimal.NewFromInt(int64(quota)).Mul(rate).Div(decimal.NewFromFloat(common.QuotaPerUnit))
	return creditBakingCookies(tx, userID, source, cookies, now)
}

func creditBakingSubscription(tx *gorm.DB, order *SubscriptionOrder) error {
	if !bakingActive(bakingNow()) || order.PaymentProvider == PaymentProviderBalance || order.PaymentMethod == PaymentMethodBalance || order.Money <= 0 {
		return nil
	}
	if math.IsNaN(order.Money) || math.IsInf(order.Money, 0) {
		return errors.New("Invalid subscription payment amount")
	}
	return creditBakingCookies(tx, order.UserId, fmt.Sprintf("subscription:%d", order.Id), decimal.NewFromFloat(order.Money).Mul(decimal.NewFromInt(10)), bakingNow())
}

func lockBakingUser(tx *gorm.DB, userID int) error {
	// SQLite has no SELECT FOR UPDATE: acquire its write lock before reading
	// the account so concurrent actions cannot both consume the same ingredient.
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		if err := tx.Model(&User{}).Where("id = ?", userID).UpdateColumn("quota", gorm.Expr("quota")).Error; err != nil {
			return err
		}
	}
	var user User
	return lockForUpdate(tx).Select("id").Where("id = ? AND status = ?", userID, common.UserStatusEnabled).First(&user).Error
}

func finishBakingRound(tx *gorm.DB, account *BakingAccount, round *BakingRound, now time.Time) error {
	if round.Status != "baking" || now.UnixMilli() < round.ReadyAt {
		return nil
	}
	round.Status = "burnt"
	if round.PendingSuccess {
		round.Level++
		round.Status = "ready"
		if round.Level > account.BestLevel {
			account.BestLevel = round.Level
			if err := tx.Model(account).UpdateColumn("best_level", account.BestLevel).Error; err != nil {
				return err
			}
		}
	}
	round.Version++
	round.PendingSuccess = false
	round.ReadyAt = 0
	round.UpdatedAt = now.UnixMilli()
	return tx.Save(round).Error
}

func GetBakingState(userID int) (*BakingState, error) {
	now := bakingNow()
	state := &BakingState{ServerTime: now.UnixMilli(), StartsAt: bakingStart.UnixMilli(), EndsAt: bakingEnd.UnixMilli(), Phase: "active", Milestones: bakingMilestones, Rewards: bakingRewards, Chances: bakingChances, History: []BakingRound{}}
	if now.Before(bakingStart) {
		state.Phase = "upcoming"
	} else if !now.Before(bakingEnd) {
		state.Phase = "ended"
	}
	err := DB.Where("event = ? AND user_id = ?", bakingEvent, userID).First(&state.BakingAccount).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return state, nil
	}
	if err != nil {
		return nil, err
	}
	if state.ActiveRoundID > 0 {
		var round BakingRound
		if err := DB.Where("id = ? AND user_id = ? AND event = ?", state.ActiveRoundID, userID, bakingEvent).First(&round).Error; err != nil {
			return nil, err
		}
		if round.Status == "baking" && now.UnixMilli() >= round.ReadyAt {
			err = DB.Transaction(func(tx *gorm.DB) error {
				if err := lockBakingUser(tx, userID); err != nil {
					return err
				}
				if err := tx.First(&state.BakingAccount, state.ID).Error; err != nil {
					return err
				}
				round = BakingRound{}
				if err := tx.First(&round, state.ActiveRoundID).Error; err != nil {
					return err
				}
				return finishBakingRound(tx, &state.BakingAccount, &round, now)
			})
			if err != nil {
				return nil, err
			}
		}
		state.Round = &round
	}
	state.CreditedCookies = float64(state.CreditedMicros) / float64(bakingMicros)
	state.Granted = bakingGranted(state.CreditedMicros)
	state.Available = state.Granted - state.Used
	err = DB.Where("event = ? AND user_id = ? AND status IN ?", bakingEvent, userID, []string{"claimed", "burnt"}).Order("id DESC").Limit(state.Used).Find(&state.History).Error
	return state, err
}

func ExecuteBakingAction(userID int, action string, command BakingCommand) (*BakingState, error) {
	now := bakingNow()
	if action != "claim" && !bakingActive(now) {
		return nil, ErrBakingClosed
	}
	var awarded int
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockBakingUser(tx, userID); err != nil {
			return err
		}
		account, err := ensureBakingAccount(tx, userID)
		if err != nil {
			return err
		}
		if action == "start" {
			if command.Version != account.Used {
				return ErrBakingChanged
			}
			if account.ActiveRoundID > 0 {
				var current BakingRound
				if err := tx.First(&current, account.ActiveRoundID).Error; err != nil {
					return err
				}
				if current.Status == "ready" || current.Status == "baking" {
					return ErrBakingChanged
				}
			}
			if bakingGranted(account.CreditedMicros) <= account.Used {
				return ErrBakingNoMaterial
			}
			rate, err := bakingCurrencyRate()
			if err != nil {
				return err
			}
			round := BakingRound{Event: bakingEvent, UserID: userID, Serial: account.Used + 1, Status: "ready", QuotaPerCookie: decimal.NewFromFloat(common.QuotaPerUnit).Div(rate).String(), CreatedAt: now.UnixMilli(), UpdatedAt: now.UnixMilli()}
			if err := tx.Create(&round).Error; err != nil {
				return err
			}
			return tx.Model(account).Updates(map[string]interface{}{"used": account.Used + 1, "active_round_id": round.ID}).Error
		}
		if command.RoundID <= 0 || command.RoundID != account.ActiveRoundID {
			return ErrBakingChanged
		}
		var round BakingRound
		if err := tx.Where("id = ? AND user_id = ? AND event = ?", command.RoundID, userID, bakingEvent).First(&round).Error; err != nil {
			return err
		}
		if round.Status != "ready" || round.Version != command.Version || round.Level < 0 || round.Level >= len(bakingRewards) {
			return ErrBakingChanged
		}
		switch action {
		case "bake":
			if round.Level >= len(bakingChances) {
				return ErrBakingChanged
			}
			roll, err := rand.Int(rand.Reader, big.NewInt(100))
			if err != nil {
				return err
			}
			wait, err := rand.Int(rand.Reader, big.NewInt(BakingMaxDuration-BakingMinDuration+1))
			if err != nil {
				return err
			}
			round.PendingSuccess = roll.Int64() < int64(bakingChances[round.Level])
			round.Status = "baking"
			round.ReadyAt = now.UnixMilli() + BakingMinDuration + wait.Int64()
		case "claim":
			unit, err := decimal.NewFromString(round.QuotaPerCookie)
			if err != nil || !unit.IsPositive() {
				return errors.New("Invalid baking reward")
			}
			awarded, err = common.QuotaFromDecimalStrict(unit.Mul(decimal.NewFromInt(int64(bakingRewards[round.Level]))).Floor())
			if err != nil {
				return err
			}
			if err := creditUserQuota(tx, userID, awarded, nil); err != nil {
				return err
			}
			round.Status = "claimed"
			round.ClaimedCookies = bakingRewards[round.Level]
			if err := tx.Model(account).UpdateColumn("claimed_cookies", gorm.Expr("claimed_cookies + ?", round.ClaimedCookies)).Error; err != nil {
				return err
			}
		default:
			return ErrBakingChanged
		}
		round.Version++
		round.UpdatedAt = now.UnixMilli()
		return tx.Save(&round).Error
	})
	if err != nil {
		return nil, err
	}
	if awarded > 0 {
		syncCreditUserQuotaCache(userID, awarded, "baking reward")
		RecordLog(userID, LogTypeSystem, fmt.Sprintf("幸运烘焙坊奖励到账，炉次 ID %d，额度 %d", command.RoundID, awarded))
	}
	return GetBakingState(userID)
}
