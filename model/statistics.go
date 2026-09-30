package model

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type StatisticsHour struct {
	Timestamp                 int64   `json:"timestamp"`
	Requests                  int64   `json:"requests"`
	SubscriptionRequests      int64   `json:"subscription_requests"`
	ConsumedQuota             int64   `json:"consumed_quota"`
	SubscriptionConsumedQuota int64   `json:"subscription_consumed_quota"`
	RedeemedQuota             int64   `json:"redeemed_quota"`
	RedeemedCount             int64   `json:"redeemed_count"`
	OnlineTopup               float64 `json:"online_topup"`
	OnlineTopupCount          int64   `json:"online_topup_count"`
	SubscriptionTopup         float64 `json:"subscription_topup"`
	SubscriptionTopupCount    int64   `json:"subscription_topup_count"`
	RedemptionTopup           float64 `json:"redemption_topup"`
	TopupCount                int64   `json:"topup_count"`
}

type DailyStatistics struct {
	Date     string           `json:"date"`
	Today    string           `json:"today"`
	Days     int              `json:"days"`
	AsOf     int64            `json:"as_of"`
	Hours    []StatisticsHour `json:"hours"`
	Previous StatisticsHour   `json:"previous"`
}

var ErrStatisticsDate = errors.New("请选择近30天内的日期，或近7天、近30天汇总")

func GetDailyStatistics(date string, now time.Time, days int) (*DailyStatistics, error) {
	if days != 1 && days != 7 && days != 30 {
		return nil, ErrStatisticsDate
	}
	location := time.FixedZone("UTC+8", 8*60*60)
	today := now.In(location).Format(time.DateOnly)
	if date == "" {
		date = today
	}
	day, err := time.ParseInLocation(time.DateOnly, date, location)
	if err != nil || date > today || date < now.In(location).AddDate(0, 0, -29).Format(time.DateOnly) || (days != 1 && date != today) {
		return nil, ErrStatisticsDate
	}
	start := day.AddDate(0, 0, 1-days).Unix()
	end := min(day.AddDate(0, 0, 1).Unix(), now.Unix()+1)
	step := int64(3600)
	if days > 1 {
		step = 86400
	}
	hours, err := getStatisticsBuckets(start, end, step)
	if err != nil {
		return nil, err
	}
	// Compare equal elapsed time, including the same partial hour/day.
	previous, err := getStatisticsBuckets(start-int64(days)*86400, end-int64(days)*86400, step)
	if err != nil {
		return nil, err
	}
	result := &DailyStatistics{Date: date, Today: today, Days: days, AsOf: now.Unix(), Hours: hours}
	for _, row := range previous {
		result.Previous.add(row)
	}
	return result, nil
}

func (s *StatisticsHour) add(row StatisticsHour) {
	s.Requests += row.Requests
	s.SubscriptionRequests += row.SubscriptionRequests
	s.ConsumedQuota += row.ConsumedQuota
	s.SubscriptionConsumedQuota += row.SubscriptionConsumedQuota
	s.RedeemedQuota += row.RedeemedQuota
	s.RedeemedCount += row.RedeemedCount
	s.OnlineTopup += row.OnlineTopup
	s.OnlineTopupCount += row.OnlineTopupCount
	s.SubscriptionTopup += row.SubscriptionTopup
	s.SubscriptionTopupCount += row.SubscriptionTopupCount
	s.RedemptionTopup += row.RedemptionTopup
	s.TopupCount += row.TopupCount
}

func getStatisticsBuckets(start, end, step int64) ([]StatisticsHour, error) {
	rows := make([]StatisticsHour, (end-start+step-1)/step)
	for i := range rows {
		rows[i].Timestamp = start + int64(i)*step
	}
	// UTC+8 day boundaries; the same expression also works for hourly buckets.
	requestBucket := fmt.Sprintf("created_at - ((created_at + 28800) %% %d)", step)
	paymentBucket := fmt.Sprintf("complete_time - ((complete_time + 28800) %% %d)", step)
	redemptionBucket := fmt.Sprintf("redeemed_time - ((redeemed_time + 28800) %% %d)", step)

	// Retries can write several logs for one request; count it once, including failures.
	// Billing metadata is serialized JSON. Legacy logs without a source use the wallet.
	subscriptionSource := `REPLACE(COALESCE(other, ''), ' ', '') LIKE '%"billing_source":"subscription"%'`
	requests := LOG_DB.Model(&Log{}).
		Select("MIN(created_at) AS created_at, SUM(CASE WHEN type = ? THEN quota ELSE 0 END) AS consumed_quota, "+
			"SUM(CASE WHEN type = ? AND "+subscriptionSource+" THEN quota ELSE 0 END) AS subscription_consumed_quota, "+
			"MAX(CASE WHEN type = ? THEN CASE WHEN "+subscriptionSource+" THEN 1 ELSE 0 END END) AS consumed_subscription, "+
			"MAX(CASE WHEN "+subscriptionSource+" THEN 1 ELSE 0 END) AS request_subscription",
			LogTypeConsume, LogTypeConsume, LogTypeConsume).
		Where("created_at >= ? AND created_at < ? AND type IN ?", start, end, []int{LogTypeConsume, LogTypeError}).
		Group("user_id, request_id, CASE WHEN request_id IS NULL OR request_id = '' THEN id ELSE 0 END")
	subscriptionTrades := DB.Model(&SubscriptionOrder{}).Select("1").Where("subscription_orders.trade_no = top_ups.trade_no")
	queries := []*gorm.DB{
		LOG_DB.Table("(?) AS requests", requests).
			Select(requestBucket + " AS timestamp, COUNT(*) AS requests, SUM(consumed_quota) AS consumed_quota, " +
				"SUM(subscription_consumed_quota) AS subscription_consumed_quota, " +
				"SUM(COALESCE(consumed_subscription, request_subscription)) AS subscription_requests").
			Group(requestBucket),
		DB.Model(&TopUp{}).
			Select(paymentBucket+" AS timestamp, SUM(money) AS online_topup, COUNT(*) AS topup_count, COUNT(*) AS online_topup_count").
			Where("status = ? AND complete_time >= ? AND complete_time < ?", common.TopUpStatusSuccess, start, end).
			Where("payment_method <> ? AND payment_provider <> ?", PaymentMethodBalance, PaymentProviderBalance).
			Where("NOT EXISTS (?)", subscriptionTrades).
			Group(paymentBucket),
		// Paid subscriptions also create top-up records, excluded above to avoid double counting.
		DB.Model(&SubscriptionOrder{}).
			Select(paymentBucket+" AS timestamp, SUM(money) AS subscription_topup, COUNT(*) AS topup_count, COUNT(*) AS subscription_topup_count").
			Where("status = ? AND complete_time >= ? AND complete_time < ?", common.TopUpStatusSuccess, start, end).
			Where("payment_method <> ? AND payment_provider <> ?", PaymentMethodBalance, PaymentProviderBalance).
			Group(paymentBucket),
	}
	for _, query := range queries {
		var grouped []StatisticsHour
		if err := query.Scan(&grouped).Error; err != nil {
			return nil, err
		}
		for _, row := range grouped {
			rows[(row.Timestamp-start)/step].add(row)
		}
	}

	// Price each code's face value separately, not the combined redeemed quota.
	var redemptions []struct {
		Timestamp int64
		Quota     int64
		Count     int64
	}
	err := DB.Unscoped().Model(&Redemption{}).
		Select(redemptionBucket+" AS timestamp, quota, COUNT(*) AS count").
		Where("status = ? AND redeemed_time >= ? AND redeemed_time < ?", common.RedemptionCodeStatusUsed, start, end).
		Group(redemptionBucket + ", quota").Scan(&redemptions).Error
	if err != nil {
		return nil, err
	}
	if len(redemptions) == 0 {
		return rows, nil
	}
	if common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) || operation_setting.Price <= 0 || math.IsNaN(operation_setting.Price) || math.IsInf(operation_setting.Price, 0) {
		return nil, errors.New("充值兑换比例无效，无法折算兑换金额")
	}
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	price := decimal.NewFromFloat(operation_setting.Price)
	settings := operation_setting.GetPaymentSetting()
	for _, code := range redemptions {
		quota := decimal.NewFromInt(code.Quota)
		money := quota.Div(quotaPerUnit).Mul(price)
		for _, amount := range settings.AmountOptions {
			presetQuota := decimal.NewFromInt(int64(amount))
			if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
				presetQuota = presetQuota.Mul(quotaPerUnit)
			}
			if quota.Equal(presetQuota) {
				discount := settings.AmountDiscount[amount]
				if discount > 0 && !math.IsInf(discount, 0) {
					money = money.Mul(decimal.NewFromFloat(discount))
				}
				break
			}
		}
		rows[(code.Timestamp-start)/step].add(StatisticsHour{
			RedeemedQuota:   code.Quota * code.Count,
			RedeemedCount:   code.Count,
			RedemptionTopup: money.Round(2).Mul(decimal.NewFromInt(code.Count)).InexactFloat64(),
			TopupCount:      code.Count,
		})
	}
	return rows, nil
}
