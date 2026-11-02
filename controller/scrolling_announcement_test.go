package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScrollingAnnouncementStatusIndependentFromTimeline(t *testing.T) {
	settings := console_setting.GetConsoleSetting()
	original := *settings
	t.Cleanup(func() { *settings = original })
	settings.AnnouncementsEnabled = false
	for _, content := range []string{"双十一活动通知", ""} {
		settings.ScrollingAnnouncement = content
		response := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(response)
		context.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
		GetStatus(context)
		var payload struct {
			Success bool           `json:"success"`
			Data    map[string]any `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		require.True(t, payload.Success)
		assert.Equal(t, content, payload.Data["scrolling_announcement"])
	}
}

func TestScrollingAnnouncementRejectsOversizedText(t *testing.T) {
	body, err := common.Marshal(map[string]string{"key": "console_setting.scrolling_announcement", "value": strings.Repeat("字", 501)})
	require.NoError(t, err)
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", bytes.NewReader(body))
	UpdateOption(context)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.False(t, payload.Success)
	assert.Contains(t, payload.Message, "500")
}
