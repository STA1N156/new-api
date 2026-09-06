package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelConnectionAllowsUnpricedModelButNormalRequestsStillRejectIt(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.QuotaData{}))
	oldLog, oldRedis := common.LogConsumeEnabled, common.RedisEnabled
	common.LogConsumeEnabled, common.RedisEnabled = true, false
	t.Cleanup(func() { common.LogConsumeEnabled, common.RedisEnabled = oldLog, oldRedis })
	user := model.User{Username: "channel-tester", Status: common.UserStatusEnabled, Role: common.RoleRootUser, Quota: 1000000}
	require.NoError(t, db.Create(&user).Error)
	const modelName = "unpriced-connection-test-model"
	_, priced, _ := ratio_setting.GetModelRatio(modelName)
	require.False(t, priced)
	_, usePrice := ratio_setting.GetModelPrice(modelName, false)
	require.False(t, usePrice)
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-test","object":"chat.completion","model":"unpriced-connection-test-model","choices":[{"index":0,"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}`))
	}))
	defer upstream.Close()
	service.InitHttpClient()
	channel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "test-key", BaseURL: &upstream.URL, Models: modelName, Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(&channel).Error)
	result := testChannel(context.Background(), &channel, user.Id, modelName, "", false)
	require.NoError(t, result.localErr)
	require.Nil(t, result.newAPIError)
	assert.EqualValues(t, 1, calls.Load())
	var log model.Log
	require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&log).Error)
	assert.Zero(t, log.Quota, "unpriced tests must not invent a price")
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	_, err := helper.ModelPriceHelper(ctx, &relaycommon.RelayInfo{OriginModelName: modelName, UserId: user.Id, UsingGroup: "default", UserGroup: "default"}, 0, &types.TokenCountMeta{})
	require.ErrorContains(t, err, "price not configured")
}
