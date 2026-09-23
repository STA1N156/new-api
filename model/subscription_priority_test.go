package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionPriorityControlsBillingAndPersists(t *testing.T) {
	plan, first := newQuotaLimitedSubscription(t)
	second, err := CreateUserSubscriptionFromPlanTx(DB, first.UserId, plan, "admin")
	require.NoError(t, err)
	require.NoError(t, DB.Model(second).Update("end_time", first.EndTime+3600).Error)
	initial, err := PreConsumeUserSubscription("default-priority", first.UserId, "model-a", 0, 1)
	require.NoError(t, err)
	assert.Equal(t, first.Id, initial.UserSubscriptionId, "old subscriptions retain earliest-expiry order")
	require.NoError(t, SetPreferredUserSubscription(first.UserId, second.Id))
	preferred, err := PreConsumeUserSubscription("preferred-request", first.UserId, "model-a", 0, 1)
	require.NoError(t, err)
	assert.Equal(t, second.Id, preferred.UserSubscriptionId)
	assert.True(t, getSubscriptionResetSub(t, second.Id).IsPreferred)
	list, err := GetAllActiveUserSubscriptions(first.UserId)
	require.NoError(t, err)
	assert.Equal(t, second.Id, list[0].Subscription.Id)

	require.NoError(t, SetPreferredUserSubscription(first.UserId, first.Id))
	assert.True(t, getSubscriptionResetSub(t, first.Id).IsPreferred)
	assert.False(t, getSubscriptionResetSub(t, second.Id).IsPreferred)
	replayed, err := PreConsumeUserSubscription("preferred-request", first.UserId, "model-a", 0, 1)
	require.NoError(t, err)
	assert.Equal(t, second.Id, replayed.UserSubscriptionId, "changing priority cannot move an existing charge")
	list, err = GetAllActiveUserSubscriptions(first.UserId)
	require.NoError(t, err)
	assert.Equal(t, first.Id, list[0].Subscription.Id)
}

func TestSubscriptionPriorityFallsBackWhenIneligible(t *testing.T) {
	for _, reason := range []string{"short quota", "model restriction", "expired"} {
		t.Run(reason, func(t *testing.T) {
			plan, first := newQuotaLimitedSubscription(t)
			otherPlan := *plan
			otherPlan.Id = 0
			require.NoError(t, DB.Create(&otherPlan).Error)
			preferred, err := CreateUserSubscriptionFromPlanTx(DB, first.UserId, &otherPlan, "admin")
			require.NoError(t, err)
			require.NoError(t, SetPreferredUserSubscription(first.UserId, preferred.Id))
			switch reason {
			case "short quota":
				preferred.QuotaLimits[0].AmountUsed = 47
				require.NoError(t, DB.Save(preferred).Error)
				// Save the preference after the quota fixture's old snapshot.
				require.NoError(t, SetPreferredUserSubscription(first.UserId, preferred.Id))
			case "model restriction":
				require.NoError(t, DB.Model(&otherPlan).Update("allowed_models", SubscriptionModels{"model-b"}).Error)
			case "expired":
				require.NoError(t, DB.Model(preferred).Update("end_time", GetDBTimestamp()).Error)
			}
			result, err := PreConsumeUserSubscription("fallback-request", first.UserId, "model-a", 0, 4)
			require.NoError(t, err)
			assert.Equal(t, first.Id, result.UserSubscriptionId)
			assert.EqualValues(t, 4, getSubscriptionResetSub(t, first.Id).AmountUsed)
		})
	}
}

func TestSubscriptionPriorityRejectsInvalidOrUnownedSubscriptions(t *testing.T) {
	plan, first := newQuotaLimitedSubscription(t)
	require.NoError(t, SetPreferredUserSubscription(first.UserId, first.Id))
	for _, state := range []string{"foreign", "expired", "cancelled"} {
		other, err := CreateUserSubscriptionFromPlanTx(DB, first.UserId, plan, "admin")
		require.NoError(t, err)
		switch state {
		case "foreign":
			other.UserId++
		case "expired":
			other.EndTime = GetDBTimestamp()
		case "cancelled":
			other.Status = "cancelled"
		}
		require.NoError(t, DB.Save(other).Error)
		require.Error(t, SetPreferredUserSubscription(first.UserId, other.Id), state)
		assert.True(t, getSubscriptionResetSub(t, first.Id).IsPreferred)
		assert.False(t, getSubscriptionResetSub(t, other.Id).IsPreferred)
	}
	require.Error(t, SetPreferredUserSubscription(0, first.Id))
	require.Error(t, SetPreferredUserSubscription(first.UserId, 0))
}
