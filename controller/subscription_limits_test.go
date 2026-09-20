package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAdminSubscriptionPlanLimitsSavePreserveAndClear(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))
	oldDB := model.DB
	model.DB = db
	payment := operation_setting.GetPaymentSetting()
	oldPayment := *payment
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		model.DB = oldDB
		*payment = oldPayment
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	router := gin.New()
	router.POST("/plans", AdminCreateSubscriptionPlan)
	router.PUT("/plans/:id", AdminUpdateSubscriptionPlan)

	plan := map[string]interface{}{
		"title": "多周期套餐", "price_amount": 28,
		"duration_unit": "month", "duration_value": 1,
		"quota_reset_period": "custom", "quota_reset_custom_seconds": 604800,
		"total_amount":   300,
		"quota_limits":   []map[string]int64{{"period_seconds": 18000, "amount_total": 50}},
		"allowed_models": []string{" model-a ", "model-b", "model-a"},
	}
	send := func(method, path string, success bool) {
		t.Helper()
		body, err := common.Marshal(map[string]interface{}{"plan": plan})
		require.NoError(t, err)
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		var response struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.Equal(t, success, response.Success, recorder.Body.String())
	}
	send(http.MethodPost, "/plans", true)
	var saved model.SubscriptionPlan
	require.NoError(t, db.First(&saved).Error)
	require.Len(t, saved.QuotaLimits, 1)
	assert.EqualValues(t, 50, saved.QuotaLimits[0].AmountTotal)
	assert.Equal(t, model.SubscriptionModels{"model-a", "model-b"}, saved.AllowedModels)
	path := "/plans/" + strconv.Itoa(saved.Id)

	delete(plan, "quota_limits")
	delete(plan, "allowed_models")
	send(http.MethodPut, path, true)
	require.NoError(t, db.First(&saved, saved.Id).Error)
	require.Len(t, saved.QuotaLimits, 1)
	assert.Equal(t, model.SubscriptionModels{"model-a", "model-b"}, saved.AllowedModels)

	plan["allowed_models"] = []string{" "}
	send(http.MethodPut, path, false)
	require.NoError(t, db.First(&saved, saved.Id).Error)
	assert.Equal(t, model.SubscriptionModels{"model-a", "model-b"}, saved.AllowedModels)
	plan["allowed_models"] = []string{"model-c"}

	plan["quota_limits"] = []map[string]int64{{"period_seconds": 0, "amount_total": 50}}
	send(http.MethodPut, path, false)
	require.NoError(t, db.First(&saved, saved.Id).Error)
	assert.EqualValues(t, 18000, saved.QuotaLimits[0].PeriodSeconds)

	plan["quota_limits"] = []map[string]int64{{"period_seconds": 18000, "amount_total": 60}, {"period_seconds": 86400, "amount_total": 100}}
	send(http.MethodPut, path, true)
	require.NoError(t, db.First(&saved, saved.Id).Error)
	require.Len(t, saved.QuotaLimits, 2)
	assert.Equal(t, model.SubscriptionModels{"model-c"}, saved.AllowedModels)
	assert.EqualValues(t, 60, saved.QuotaLimits[0].AmountTotal)

	plan["quota_limits"] = []map[string]int64{}
	plan["allowed_models"] = []string{}
	send(http.MethodPut, path, true)
	saved = model.SubscriptionPlan{Id: saved.Id}
	require.NoError(t, db.First(&saved, saved.Id).Error)
	assert.Empty(t, saved.QuotaLimits)
	assert.Empty(t, saved.AllowedModels)
	assert.Equal(t, "多周期套餐", saved.Title)
	assert.EqualValues(t, 300, saved.TotalAmount)
	assert.EqualValues(t, 604800, saved.QuotaResetCustomSeconds)
}
