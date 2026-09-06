package model

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
)

// SubscriptionQuotaLimits holds independent fixed-duration quotas. Usage fields
// are populated only on a user's subscription, never on the plan.
type SubscriptionQuotaLimit struct {
	PeriodSeconds int64 `json:"period_seconds"`
	AmountTotal   int64 `json:"amount_total"`
	AmountUsed    int64 `json:"amount_used,omitempty"`
	LastResetTime int64 `json:"last_reset_time,omitempty"`
}

type SubscriptionQuotaLimits []SubscriptionQuotaLimit

func (limits SubscriptionQuotaLimits) Value() (driver.Value, error) {
	if len(limits) == 0 {
		return nil, nil
	}
	data, err := common.Marshal(limits)
	return string(data), err
}

func (limits *SubscriptionQuotaLimits) Scan(value interface{}) error {
	*limits = nil
	switch v := value.(type) {
	case nil:
		return nil
	case []byte:
		return common.Unmarshal(v, limits)
	case string:
		return common.UnmarshalJsonStr(v, limits)
	default:
		return fmt.Errorf("invalid subscription quota limits: %T", value)
	}
}

func (p *SubscriptionPlan) ValidateQuotaLimits() error {
	if len(p.QuotaLimits) > 8 {
		return errors.New("最多设置8个附加额度周期")
	}
	seen := make(map[int64]bool, len(p.QuotaLimits))
	for i := range p.QuotaLimits {
		limit := &p.QuotaLimits[i]
		if limit.PeriodSeconds < 1 || limit.PeriodSeconds > 366*86400 || limit.AmountTotal <= 0 || limit.AmountTotal > 1<<53-1 {
			return errors.New("附加周期需为1秒至366天，额度需为正数且不超过9007199254740991")
		}
		if seen[limit.PeriodSeconds] {
			return errors.New("附加额度周期不能重复")
		}
		seen[limit.PeriodSeconds] = true
		limit.AmountUsed = 0
		limit.LastResetTime = 0
	}
	return nil
}

// Reset only the windows that elapsed; resetting a short window never restores
// the main quota. Advance arithmetically so long idle periods take constant time.
func (sub *UserSubscription) resetQuotaLimits(now int64) {
	sub.NextQuotaResetTime = 0
	for i := range sub.QuotaLimits {
		limit := &sub.QuotaLimits[i]
		if limit.PeriodSeconds <= 0 {
			continue
		}
		if limit.LastResetTime == 0 {
			limit.LastResetTime = sub.StartTime
		}
		if now >= limit.LastResetTime+limit.PeriodSeconds {
			limit.LastResetTime += (now - limit.LastResetTime) / limit.PeriodSeconds * limit.PeriodSeconds
			limit.AmountUsed = 0
		}
		next := limit.LastResetTime + limit.PeriodSeconds
		if next < sub.EndTime && (sub.NextQuotaResetTime == 0 || next < sub.NextQuotaResetTime) {
			sub.NextQuotaResetTime = next
		}
	}
}

func subscriptionQuotaAfterDelta(used, total, delta int64, enforceLimit bool) (int64, error) {
	if delta > 0 && (used > math.MaxInt64-delta || (enforceLimit && total > 0 && delta > total-used)) {
		return 0, errors.New("subscription quota insufficient")
	}
	if delta < -used {
		return 0, nil
	}
	return used + delta, nil
}

// All counters are checked before saving the subscription in the same locked
// transaction. Late refunds/settlements must not alter a newer quota window.
func (sub *UserSubscription) applyQuotaDelta(delta, chargedAt int64, enforceLimit bool) error {
	var err error
	if chargedAt == 0 || chargedAt >= sub.LastResetTime {
		sub.AmountUsed, err = subscriptionQuotaAfterDelta(sub.AmountUsed, sub.AmountTotal, delta, enforceLimit)
		if err != nil {
			return err
		}
	}
	for i := range sub.QuotaLimits {
		limit := &sub.QuotaLimits[i]
		if chargedAt > 0 && chargedAt < limit.LastResetTime {
			continue
		}
		limit.AmountUsed, err = subscriptionQuotaAfterDelta(limit.AmountUsed, limit.AmountTotal, delta, enforceLimit)
		if err != nil {
			return fmt.Errorf("subscription quota insufficient: %d-second quota exhausted", limit.PeriodSeconds)
		}
	}
	return nil
}
