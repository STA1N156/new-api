package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestStatisticsRequiresSuperAdmin(t *testing.T) {
	previousDB, previousLogDB, previousRedis := model.DB, model.LOG_DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB, common.RedisEnabled = db, db, false
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled = previousDB, previousLogDB, previousRedis
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.Redemption{}, &model.TopUp{}, &model.SubscriptionOrder{}))
	router := gin.New()
	router.GET("/api/data/statistics", middleware.RootAuth(), GetDailyStatistics)
	for _, item := range []struct {
		name         string
		role, status int
	}{
		{"user", common.RoleCommonUser, http.StatusForbidden},
		{"admin", common.RoleAdminUser, http.StatusForbidden},
		{"root", common.RoleRootUser, http.StatusOK},
	} {
		t.Run(item.name, func(t *testing.T) {
			token := "statistics-test-" + item.name
			user := model.User{Id: 953000 + item.role, Username: "stats-" + item.name, Role: item.role, Status: common.UserStatusEnabled, AccessToken: &token, AffCode: "stats-" + item.name}
			require.NoError(t, db.Create(&user).Error)
			request := httptest.NewRequest(http.MethodGet, "/api/data/statistics", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, item.status, response.Code, response.Body.String())
		})
	}
}
