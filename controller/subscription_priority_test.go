package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionPriorityUsesAuthenticatedOwner(t *testing.T) {
	previousDB, previousRedis := model.DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB, common.RedisEnabled = db, false
	t.Cleanup(func() {
		model.DB, common.RedisEnabled = previousDB, previousRedis
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSubscription{}))
	token := "subscription-priority-test-token"
	user := model.User{Id: 953001, Username: "priority-user", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, AccessToken: &token}
	require.NoError(t, db.Create(&user).Error)
	subs := []model.UserSubscription{
		{Id: 1, UserId: user.Id, Status: "active", EndTime: common.GetTimestamp() + 3600},
		{Id: 2, UserId: user.Id + 1, Status: "active", EndTime: common.GetTimestamp() + 3600},
	}
	require.NoError(t, db.Create(&subs).Error)
	router := gin.New()
	router.PUT("/api/subscription/self/:id/priority", middleware.UserAuth(), UpdateSubscriptionPriority)
	for _, item := range []struct {
		id      string
		success bool
	}{
		{"1", true}, {"2", false}, {"0", false}, {"invalid", false},
	} {
		t.Run(item.id, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPut, "/api/subscription/self/"+item.id+"/priority", strings.NewReader(`{"user_id":953002}`))
			request.Header.Set("Authorization", "Bearer "+token)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			var body struct{ Success bool }
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
			require.Equal(t, item.success, body.Success, response.Body.String())
		})
	}
	require.NoError(t, db.Find(&subs).Error)
	require.True(t, subs[0].IsPreferred)
	require.False(t, subs[1].IsPreferred)
}
