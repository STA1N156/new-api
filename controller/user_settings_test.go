package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateUserSettingWithoutQuotaAlerts(t *testing.T) {
	for _, tc := range []struct {
		name       string
		role       int
		notifyType string
		fields     string
		recordIP   bool
	}{
		{"IP recording disabled", common.RoleCommonUser, "email", "", false},
		{"IP recording enabled", common.RoleCommonUser, "email", "", true},
		{"legacy threshold ignored", common.RoleCommonUser, "email", `,"quota_warning_threshold":-1`, false},
		{"admin email", common.RoleAdminUser, "email", `,"notification_email":"admin@example.com"`, false},
		{"admin webhook", common.RoleAdminUser, "webhook", `,"webhook_url":"https://example.com/hook"`, false},
		{"admin bark", common.RoleAdminUser, "bark", `,"bark_url":"https://example.com/bark"`, false},
		{"admin gotify", common.RoleAdminUser, "gotify", `,"gotify_url":"https://example.com","gotify_token":"test-token"`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			user := model.User{
				Username: "settings-user", Role: tc.role, Status: common.UserStatusEnabled,
				Setting: `{"notify_type":"email","quota_warning_threshold":500000,"record_ip_log":true}`,
			}
			require.NoError(t, db.Create(&user).Error)

			gin.SetMode(gin.TestMode)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			body := `{"notify_type":"` + tc.notifyType + `","record_ip_log":` + common.GetJsonString(tc.recordIP) + `,"upstream_model_update_notify_enabled":true` + tc.fields + `}`
			c.Request = httptest.NewRequest(http.MethodPut, "/api/user/setting", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("id", user.Id)
			UpdateUserSetting(c)

			assert.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":true`)
			var saved model.User
			require.NoError(t, db.First(&saved, user.Id).Error)
			settings := saved.GetSetting()
			assert.Equal(t, tc.notifyType, settings.NotifyType)
			assert.Equal(t, tc.recordIP, settings.RecordIpLog)
			assert.Equal(t, tc.role >= common.RoleAdminUser, settings.UpstreamModelUpdateNotifyEnabled)
			assert.NotContains(t, saved.Setting, "quota_warning_threshold")
		})
	}
}
