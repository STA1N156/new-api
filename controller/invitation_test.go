package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelfInvitationDetailsPreserveLegacyIncomeAndExposeRewards(t *testing.T) {
	db := setupManageUserTestDB(t)
	oldInviter, oldInvitee := common.QuotaForInviter, common.QuotaForInvitee
	common.QuotaForInviter, common.QuotaForInvitee = 50000, 100000
	t.Cleanup(func() { common.QuotaForInviter, common.QuotaForInvitee = oldInviter, oldInvitee })
	user := model.User{Username: "inviter", AffCode: "sender", AffQuota: 500000, AffHistoryQuota: 1500000, AffTopUpQuota: 1000000}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&model.User{Username: "friend", AffCode: "friend", InviterId: user.Id}).Error)
	data := buildSelfUserData(&user)
	assert.EqualValues(t, 1, data["aff_count"])
	assert.EqualValues(t, 500000, data["aff_quota"])
	assert.EqualValues(t, 1500000, data["aff_history_quota"])
	assert.EqualValues(t, 1000000, data["aff_topup_quota"])
	assert.Equal(t, 50000, data["aff_inviter_reward"])
	assert.Equal(t, 100000, data["aff_invitee_reward"])
	assert.Equal(t, 8, data["aff_topup_reward_percent"])
}
