package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelDiscountPersistsWithoutChangingBilling(t *testing.T) {
	resetPricingEndpointTestTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	originalDiscounts := ratio_setting.ModelDiscount2JSONString()
	originalPrices := ratio_setting.ModelPrice2JSONString()
	originalRatios := ratio_setting.ModelRatio2JSONString()
	originalCompletion := ratio_setting.CompletionRatio2JSONString()
	billing := config.GlobalConfig.Get("billing_setting").(*billing_setting.BillingSetting)
	originalBilling := *billing
	billing.BillingMode = map[string]string{"动态模型": "tiered_expr"}
	billing.BillingExpr = map[string]string{"动态模型": `tier("base", p * 2 + c * 4)`}
	common.OptionMapRWMutex.Lock()
	originalOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		*billing = originalBilling
		require.NoError(t, ratio_setting.UpdateModelDiscountByJSONString(originalDiscounts))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalRatios))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(originalCompletion))
		require.NoError(t, DB.Where("key = ?", "ModelDiscount").Delete(&Option{}).Error)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptions
		common.OptionMapRWMutex.Unlock()
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"discount-request":0.5,"动态模型":1}`))
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"中文模型":1,"other":2}`))
	require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(`{"中文模型":2}`))
	insertPricingEndpointChannel(t, 501, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	for _, name := range []string{"中文模型", "other", "discount-request", "动态模型"} {
		insertPricingEndpointAbility(t, 501, name)
	}
	InitChannelCache()
	GetPricing() // Populate the cache before changing the discount.
	const discounts = `{"中文模型":5.5,"discount-request":3,"动态模型":10}`
	require.NoError(t, UpdateOption("ModelDiscount", discounts))
	var saved Option
	require.NoError(t, DB.First(&saved, "key = ?", "ModelDiscount").Error)
	assert.JSONEq(t, discounts, saved.Value)
	for _, pricing := range GetPricing() {
		if pricing.ModelName == "中文模型" {
			require.NotNil(t, pricing.ModelDiscount)
			assert.Equal(t, 5.5, *pricing.ModelDiscount)
			assert.Equal(t, 1.0, pricing.ModelRatio)
			assert.Equal(t, 2.0, pricing.CompletionRatio)
		} else if pricing.ModelName == "动态模型" {
			require.NotNil(t, pricing.ModelDiscount)
			assert.Equal(t, 10.0, *pricing.ModelDiscount)
			assert.Equal(t, "tiered_expr", pricing.BillingMode)
			assert.Equal(t, `tier("base", p * 2 + c * 4)`, pricing.BillingExpr)
		} else {
			assert.Nil(t, pricing.ModelDiscount)
		}
	}
	for _, invalid := range []string{`null`, `[]`, `{"中文模型":0}`, `{"中文模型":-1}`, `{"中文模型":11}`, `{"中文模型":"5.5"}`, `{"中文模型":null}`, `{"中文模型":5.5,"other":11}`} {
		require.Error(t, UpdateOption("ModelDiscount", invalid))
		require.NoError(t, DB.First(&saved, "key = ?", "ModelDiscount").Error)
		assert.JSONEq(t, discounts, saved.Value)
		assert.JSONEq(t, saved.Value, ratio_setting.ModelDiscount2JSONString())
	}
	assert.JSONEq(t, `{"discount-request":0.5,"动态模型":1}`, ratio_setting.ModelPrice2JSONString())
	assert.JSONEq(t, `{"中文模型":1,"other":2}`, ratio_setting.ModelRatio2JSONString())
	assert.JSONEq(t, `{"中文模型":2}`, ratio_setting.CompletionRatio2JSONString())
	require.NoError(t, UpdateOption("ModelDiscount", `{}`))
	for _, pricing := range GetPricing() {
		assert.Nil(t, pricing.ModelDiscount)
	}
}
