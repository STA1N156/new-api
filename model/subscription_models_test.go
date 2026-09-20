package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionModelScopeChangesApplyToExistingSubscribers(t *testing.T) {
	plan, first := newQuotaLimitedSubscription(t)
	second, err := CreateUserSubscriptionFromPlanTx(DB, 7002, plan, "admin")
	require.NoError(t, err)
	// A legacy plan is unrestricted, including when an old copy remains cached.
	_, err = GetSubscriptionPlanById(plan.Id)
	require.NoError(t, err)
	_, err = PreConsumeUserSubscription("legacy-model", first.UserId, "any-model", 0, 4)
	require.NoError(t, err)
	require.NoError(t, RefundSubscriptionPreConsume("legacy-model"))
	require.NoError(t, DB.Model(plan).Update("allowed_models", SubscriptionModels{"public-model"}).Error)

	for _, sub := range []*UserSubscription{first, second} {
		for _, name := range []string{"other-model", "public-model-extra", "PUBLIC-MODEL", ""} {
			_, err = PreConsumeUserSubscription(fmt.Sprintf("blocked-%d-%s", sub.Id, name), sub.UserId, name, 0, 4)
			require.ErrorIs(t, err, ErrSubscriptionModelNotAllowed)
		}
		stored := getSubscriptionResetSub(t, sub.Id)
		assert.Zero(t, stored.AmountUsed)
		assert.Zero(t, stored.QuotaLimits[0].AmountUsed)
		_, err = PreConsumeUserSubscription(fmt.Sprintf("allowed-%d", sub.Id), sub.UserId, "public-model", 0, 4)
		require.NoError(t, err)
		assert.EqualValues(t, 4, getSubscriptionResetSub(t, sub.Id).AmountUsed)
	}

	// Changing the scope never strands settlement/refunds of an in-flight request.
	require.NoError(t, DB.Model(plan).Update("allowed_models", SubscriptionModels{"new-model"}).Error)
	_, err = PreConsumeUserSubscription("removed-model", first.UserId, "public-model", 0, 4)
	require.ErrorIs(t, err, ErrSubscriptionModelNotAllowed)
	require.NoError(t, PostConsumeUserSubscriptionDelta(first.Id, 2))
	require.NoError(t, RefundSubscriptionPreConsume(fmt.Sprintf("allowed-%d", first.Id)))
	assert.EqualValues(t, 2, getSubscriptionResetSub(t, first.Id).AmountUsed)
	_, err = PreConsumeUserSubscription("new-model", first.UserId, "new-model", 0, 4)
	require.NoError(t, err)

	// Clearing the list restores unrestricted use for the same subscription.
	require.NoError(t, DB.Model(plan).Update("allowed_models", SubscriptionModels{}).Error)
	_, err = PreConsumeUserSubscription("scope-cleared", second.UserId, "other-model", 0, 4)
	require.NoError(t, err)
}

func TestSubscriptionModelScopeSkipsIneligiblePlan(t *testing.T) {
	plan, first := newQuotaLimitedSubscription(t)
	require.NoError(t, DB.Model(plan).Update("allowed_models", SubscriptionModels{"model-a"}).Error)
	otherPlan := *plan
	otherPlan.Id = 0
	otherPlan.AllowedModels = SubscriptionModels{"model-b"}
	require.NoError(t, DB.Create(&otherPlan).Error)
	second, err := CreateUserSubscriptionFromPlanTx(DB, first.UserId, &otherPlan, "admin")
	require.NoError(t, err)
	require.NoError(t, DB.Model(second).Update("end_time", first.EndTime+3600).Error)
	result, err := PreConsumeUserSubscription("choose-eligible", first.UserId, "model-b", 0, 4)
	require.NoError(t, err)
	assert.Equal(t, second.Id, result.UserSubscriptionId)
	assert.Zero(t, getSubscriptionResetSub(t, first.Id).AmountUsed)
	assert.EqualValues(t, 4, getSubscriptionResetSub(t, second.Id).AmountUsed)
}
