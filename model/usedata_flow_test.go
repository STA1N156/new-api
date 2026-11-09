package model

import (
	"context"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDashboardReadsConsumptionWithoutStatisticsWrites(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 1, Username: "alice"}).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("username", "alice")
	RecordConsumeLog(c, 1, RecordConsumeLogParams{ModelName: "gpt-a", Quota: 100, PromptTokens: 40, CompletionTokens: 20})
	var log Log
	require.NoError(t, LOG_DB.First(&log).Error)
	require.Equal(t, 100, log.Quota)
	var saved int64
	require.NoError(t, DB.Model(&QuotaData{}).Count(&saved).Error)
	require.Zero(t, saved)
	rows, err := GetQuotaDataByUserId(context.Background(), 1, log.CreatedAt-1, log.CreatedAt+1)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 1, rows[0].Count)
	require.Equal(t, 100, rows[0].Quota)
	require.Equal(t, 60, rows[0].TokenUsed)
	require.Equal(t, log.CreatedAt-log.CreatedAt%3600, rows[0].CreatedAt)
}

func TestDashboardAggregationAndUserIsolation(t *testing.T) {
	truncateTables(t)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 1, Username: "alice", Type: LogTypeConsume, ModelName: "gpt-a", CreatedAt: 3661, Quota: 100, PromptTokens: 40, CompletionTokens: 20},
		{UserId: 1, Username: "alice", Type: LogTypeConsume, ModelName: "gpt-a", CreatedAt: 3700, Quota: 50, PromptTokens: 10},
		{UserId: 2, Username: "bob", Type: LogTypeConsume, ModelName: "gpt-a", CreatedAt: 3700, Quota: 25},
		{UserId: 1, Username: "alice", Type: LogTypeError, ModelName: "gpt-a", CreatedAt: 3700, Quota: 999},
		{UserId: 1, Username: "alice", Type: LogTypeConsume, ModelName: "gpt-a", CreatedAt: 3900, Quota: 999},
	}).Error)
	rows, err := GetQuotaDataByUserId(context.Background(), 1, 3600, 3800)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 2, rows[0].Count)
	require.Equal(t, 150, rows[0].Quota)
	require.Equal(t, 70, rows[0].TokenUsed)
	cached, err := GetQuotaDataByUserId(context.Background(), 1, 3600, 3800)
	require.NoError(t, err)
	require.Equal(t, rows, cached)
	all, err := GetAllQuotaDates(context.Background(), 3600, 3800, "")
	require.NoError(t, err)
	require.Len(t, all, 1)
	require.Equal(t, 3, all[0].Count)
	require.Equal(t, 175, all[0].Quota)
	_, err = GetQuotaDataByUserId(context.Background(), 0, 3600, 3800)
	require.Error(t, err)
	_, err = GetAllQuotaDates(context.Background(), 3800, 3600, "")
	require.Error(t, err)
}

func TestFlowConsumptionRespectsRoleDimensions(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&Channel{Id: 1, Name: "east"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "test", Name: "primary"}).Error)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 1, Username: "alice", Type: LogTypeConsume, ModelName: "gpt-a", CreatedAt: 1100, Quota: 100, Group: "vip", TokenId: 11, ChannelId: 1, Other: `{"admin_info":{"node_name":"node-a"}}`},
		{UserId: 2, Username: "bob", Type: LogTypeConsume, ModelName: "gpt-b", CreatedAt: 1200, Quota: 70, Group: "default", TokenId: 22, ChannelId: 1},
	}).Error)
	self, err := GetFlowQuotaData(context.Background(), 900, 2000, "bob", 1, common.RoleCommonUser)
	require.NoError(t, err)
	require.Len(t, self, 1)
	require.Equal(t, 100, self[0].Quota)
	require.Equal(t, "primary", self[0].TokenName)
	require.Empty(t, self[0].Username)
	require.Zero(t, self[0].ChannelID)
	admin, err := GetFlowQuotaData(context.Background(), 900, 2000, "alice", 0, common.RoleAdminUser)
	require.NoError(t, err)
	require.Len(t, admin, 1)
	require.Equal(t, "alice", admin[0].Username)
	require.Equal(t, "east", admin[0].ChannelName)
	require.Zero(t, admin[0].TokenID)
	root, err := GetFlowQuotaData(context.Background(), 900, 2000, "alice", 0, common.RoleRootUser)
	require.NoError(t, err)
	require.Len(t, root, 1)
	require.Equal(t, "primary", root[0].TokenName)
	require.Equal(t, "east", root[0].ChannelName)
	require.Equal(t, "node-a", root[0].NodeName)
}

func TestLogNodeMetadataPreservesExistingDetails(t *testing.T) {
	other := map[string]interface{}{"billing_source": "wallet", "admin_info": map[string]interface{}{"keep": true}}
	var stored map[string]interface{}
	require.NoError(t, common.UnmarshalJsonStr(logMetadataWithNode(other, "node-a"), &stored))
	require.Equal(t, "wallet", stored["billing_source"])
	require.Equal(t, map[string]interface{}{"keep": true, "node_name": "node-a"}, stored["admin_info"])
	require.Equal(t, map[string]interface{}{"keep": true}, other["admin_info"])
}

func TestDashboardAllowsTenDifferentConcurrentQueries(t *testing.T) {
	truncateTables(t)
	entered := make(chan struct{}, 10)
	release := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	require.NoError(t, LOG_DB.Callback().Row().Before("gorm:row").Register("hold-dashboard-queries", func(tx *gorm.DB) {
		if tx.Statement.Table == "logs" {
			entered <- struct{}{}
			<-release
		}
	}))
	t.Cleanup(func() { _ = LOG_DB.Callback().Row().Remove("hold-dashboard-queries") })
	results := make(chan error, 10)
	for userID := 1; userID <= 10; userID++ {
		go func(id int) {
			_, err := GetQuotaDataByUserId(context.Background(), id, 1000, 2000)
			results <- err
		}(userID)
	}
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	for i := 0; i < 10; i++ {
		select {
		case <-entered:
		case err := <-results:
			require.NoError(t, err)
			t.Fatal("query returned before the database was released")
		case <-deadline.C:
			t.Fatal("not all ten queries reached the database")
		}
	}
	releaseOnce.Do(func() { close(release) })
	for i := 0; i < 10; i++ {
		require.NoError(t, <-results)
	}
}
