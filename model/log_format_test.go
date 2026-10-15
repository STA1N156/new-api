package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFormatUserLogsStripsQuotaSaturation verifies the admin-only quota
// saturation marker (nested under other.admin_info) is removed for non-admin
// log views, since formatUserLogs strips the whole admin_info object.
func TestFormatUserLogsStripsQuotaSaturation(t *testing.T) {
	other := common.MapToJsonStr(map[string]interface{}{
		"model_price": 0.004,
		"admin_info": map[string]interface{}{
			"quota_saturation": map[string]interface{}{
				"op":      "QuotaFromDecimal",
				"kind":    "overflow",
				"clamped": common.MaxQuota,
			},
		},
	})
	logs := []*Log{{Other: other}}

	formatUserLogs(logs, 0, false)

	parsed, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	_, hasAdminInfo := parsed["admin_info"]
	require.False(t, hasAdminInfo, "admin_info (and nested quota_saturation) must be stripped for non-admin views")
	// Non-admin billing fields remain visible.
	require.Contains(t, parsed, "model_price")
}

func TestLogResponseModelVisibility(t *testing.T) {
	for _, canView := range []bool{false, true} {
		logs := []*Log{{Other: `{"response_model_name":"actual","response_model_version":"version","upstream_model_name":"mapped","admin_info":{"use_channel":[1]}}`}}
		FilterLogResponseModels(logs, canView)
		other, err := common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, canView, other["response_model_name"] == "actual")
		assert.Equal(t, canView, other["response_model_version"] == "version")
		assert.Equal(t, "mapped", other["upstream_model_name"])
		assert.Contains(t, other, "admin_info")

		formatUserLogs(logs, 0, canView)
		other, err = common.StrToMap(logs[0].Other)
		require.NoError(t, err)
		assert.Equal(t, canView, other["response_model_name"] == "actual")
		assert.Equal(t, canView, other["response_model_version"] == "version")
		assert.NotContains(t, other, "admin_info")
	}
}
