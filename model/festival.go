package model

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const festivalCampaign = "autumn-2026"

// Freeze the published campaign denomination: 1 USD = 10 cookies.
// Later display/exchange-rate changes must not change earned chances or prizes.
const festivalQuotaPerCookie = 50000

var festivalNow = time.Now

var festivalStart = time.Date(2026, 9, 25, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600)).Unix()
var festivalEnd = time.Date(2026, 10, 8, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600)).Unix()

type FestivalCredit struct {
	ID        int    `gorm:"primaryKey"`
	Campaign  string `gorm:"type:varchar(32);uniqueIndex:idx_festival_credit_source"`
	Source    string `gorm:"type:varchar(16);uniqueIndex:idx_festival_credit_source"`
	SourceID  int    `gorm:"uniqueIndex:idx_festival_credit_source"`
	UserID    int    `gorm:"index"`
	Quota     int
	CreatedAt int64
}

type FestivalDraw struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	Campaign  string `json:"-" gorm:"type:varchar(32);uniqueIndex:idx_festival_draw_request;uniqueIndex:idx_festival_draw_number"`
	UserID    int    `json:"-" gorm:"uniqueIndex:idx_festival_draw_request;uniqueIndex:idx_festival_draw_number"`
	RequestID string `json:"request_id" gorm:"type:varchar(64);uniqueIndex:idx_festival_draw_request"`
	Number    int    `json:"number" gorm:"uniqueIndex:idx_festival_draw_number"`
	Cookies   int    `json:"cookies"`
	Quota     int    `json:"-"`
	CreatedAt int64  `json:"created_at"`
}

type FestivalPrize struct {
	Cookies int `json:"cookies"`
	Weight  int `json:"weight"`
}

type FestivalMilestone struct {
	Cookies int `json:"cookies"`
	Chances int `json:"chances"`
}

var festivalPrizes = []FestivalPrize{{50, 5500}, {100, 3500}, {200, 500}, {300, 250}, {500, 150}, {1000, 100}}
var festivalMilestones = []FestivalMilestone{{500, 1}, {1000, 2}, {2000, 2}, {3000, 3}, {4000, 3}, {5000, 4}}

type FestivalStatus struct {
	Campaign        string              `json:"campaign"`
	StartsAt        int64               `json:"starts_at"`
	EndsAt          int64               `json:"ends_at"`
	ServerTime      int64               `json:"server_time"`
	State           string              `json:"state"`
	CreditedCookies float64             `json:"credited_cookies"`
	Earned          int                 `json:"earned"`
	Remaining       int                 `json:"remaining"`
	WonCookies      int                 `json:"won_cookies"`
	Prizes          []FestivalPrize     `json:"prizes"`
	Milestones      []FestivalMilestone `json:"milestones"`
	Records         []FestivalDraw      `json:"records"`
}

// Called inside the same transaction that credits a paid top-up or redemption.
// A unique source prevents retries from granting the same progress twice.
func creditFestivalQuota(tx *gorm.DB, source string, sourceID, userID, quota int, completedAt int64) error {
	if completedAt < festivalStart || completedAt >= festivalEnd || quota <= 0 {
		return nil
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&FestivalCredit{
		Campaign: festivalCampaign, Source: source, SourceID: sourceID,
		UserID: userID, Quota: quota, CreatedAt: completedAt,
	}).Error
}

func getFestivalProgress(tx *gorm.DB, userID int) (int64, int, error) {
	var quota int64
	err := tx.Model(&FestivalCredit{}).
		Where("campaign = ? AND user_id = ?", festivalCampaign, userID).
		Select("COALESCE(SUM(quota), 0)").Scan(&quota).Error
	earned := 0
	for _, milestone := range festivalMilestones {
		if quota >= int64(milestone.Cookies)*festivalQuotaPerCookie {
			earned += milestone.Chances
		}
	}
	return quota, earned, err
}

func GetFestivalStatus(userID int) (*FestivalStatus, error) {
	quota, earned, err := getFestivalProgress(DB, userID)
	if err != nil {
		return nil, err
	}
	status := &FestivalStatus{
		Campaign: festivalCampaign, StartsAt: festivalStart, EndsAt: festivalEnd,
		ServerTime: festivalNow().Unix(), State: "active", CreditedCookies: float64(quota) / festivalQuotaPerCookie,
		Earned: earned, Prizes: festivalPrizes, Milestones: festivalMilestones, Records: []FestivalDraw{},
	}
	if status.ServerTime < festivalStart {
		status.State = "upcoming"
	}
	if status.ServerTime >= festivalEnd {
		status.State = "ended"
	}
	if err := DB.Where("campaign = ? AND user_id = ?", festivalCampaign, userID).
		Order("number DESC").Find(&status.Records).Error; err != nil {
		return nil, err
	}
	status.Remaining = max(0, earned-len(status.Records))
	for _, record := range status.Records {
		status.WonCookies += record.Cookies
	}
	return status, nil
}

func festivalPrizeForTicket(ticket int) (FestivalPrize, error) {
	if ticket < 0 || ticket >= 10000 {
		return FestivalPrize{}, errors.New("invalid festival ticket")
	}
	for _, prize := range festivalPrizes {
		if ticket < prize.Weight {
			return prize, nil
		}
		ticket -= prize.Weight
	}
	return FestivalPrize{}, errors.New("invalid festival probabilities")
}

func DrawFestival(userID int, requestID string) (*FestivalDraw, error) {
	if len(requestID) < 16 || len(requestID) > 64 {
		return nil, errors.New("Invalid draw request")
	}
	var draw FestivalDraw
	created := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		// All instances serialize draws on the same existing user row. The unique
		// draw number also protects SQLite, whose SELECT has no row-lock support.
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		err := tx.Where("campaign = ? AND user_id = ? AND request_id = ?", festivalCampaign, userID, requestID).First(&draw).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		now := festivalNow().Unix()
		if now < festivalStart {
			return errors.New("The festival has not started")
		}
		if now >= festivalEnd {
			return errors.New("The festival has ended")
		}
		_, earned, err := getFestivalProgress(tx, userID)
		if err != nil {
			return err
		}
		var used int64
		if err := tx.Model(&FestivalDraw{}).Where("campaign = ? AND user_id = ?", festivalCampaign, userID).Count(&used).Error; err != nil {
			return err
		}
		if used >= int64(earned) {
			return errors.New("No draw chances remaining")
		}
		ticket, err := rand.Int(rand.Reader, big.NewInt(10000))
		if err != nil {
			return err
		}
		prize, err := festivalPrizeForTicket(int(ticket.Int64()))
		if err != nil {
			return err
		}
		draw = FestivalDraw{Campaign: festivalCampaign, UserID: userID, RequestID: requestID,
			Number: int(used) + 1, Cookies: prize.Cookies, Quota: prize.Cookies * festivalQuotaPerCookie, CreatedAt: now}
		if err := tx.Create(&draw).Error; err != nil {
			return err
		}
		// Activity rewards never go through paid-credit or invitation hooks.
		if err := creditUserQuota(tx, userID, draw.Quota, nil); err != nil {
			return err
		}
		created = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	if created {
		syncCreditUserQuotaCache(userID, draw.Quota, "festival reward")
		RecordLog(userID, LogTypeSystem, fmt.Sprintf("双节活动抽奖 #%d，获得 %d🍪", draw.ID, draw.Cookies))
	}
	return &draw, nil
}
