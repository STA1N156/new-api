package model

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestLogsRespectIPSetting(t *testing.T) {
	for _, tc := range []struct {
		name    string
		setting string
		wantIP  string
	}{
		{"default disabled", "", ""},
		{"explicitly disabled", `{"record_ip_log":false}`, ""},
		{"invalid settings", "invalid settings", ""},
		{"explicitly enabled", `{"record_ip_log":true}`, "198.51.100.42"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupUserUpdateTestState(t)
			oldConsume, oldExport := common.LogConsumeEnabled, common.DataExportEnabled
			common.LogConsumeEnabled, common.DataExportEnabled = true, false
			t.Cleanup(func() {
				common.LogConsumeEnabled, common.DataExportEnabled = oldConsume, oldExport
			})
			user := User{Username: "ip-log-user", Setting: tc.setting}
			require.NoError(t, DB.Create(&user).Error)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			c.Request.RemoteAddr = "198.51.100.42:12345"
			c.Set("username", user.Username)

			RecordConsumeLog(c, user.Id, RecordConsumeLogParams{ModelName: "test-model", Quota: 10})
			RecordErrorLog(c, user.Id, 0, "test-model", "", "test error", 0, 0, false, "default", nil)

			var logs []Log
			require.NoError(t, LOG_DB.Where("user_id = ?", user.Id).Order("type").Find(&logs).Error)
			require.Len(t, logs, 2)
			assert.Equal(t, LogTypeConsume, logs[0].Type)
			assert.Equal(t, LogTypeError, logs[1].Type)
			for _, log := range logs {
				assert.Equal(t, tc.wantIP, log.Ip)
			}
		})
	}
}
