package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPricingInfersMiMoStepAndNovelAIVendors(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertPricingEndpointChannel(t, 101, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	for _, name := range []string{"[Cloud]MiMo-V2.5-Pro", "xiaomi/mimo-v2-flash", "step-3.5-flash", "StepFun/STEP-2", "[AN]NAI-diffusion-4.5-full", "novelai/nai-diffusion-4-curated-preview"} {
		insertPricingEndpointAbility(t, 101, name)
	}
	// 已配置描述但没有供应商的旧模型也应能自动识别。
	require.NoError(t, DB.Create(&Model{ModelName: "step-3.5-flash", Description: "Saved description", Status: 1}).Error)
	InitChannelCache()
	pricings := GetPricing()
	vendors := make(map[int]PricingVendor)
	for _, vendor := range GetVendors() {
		vendors[vendor.ID] = vendor
	}
	require.Len(t, pricings, 6)
	for _, pricing := range pricings {
		vendor, ok := vendors[pricing.VendorID]
		require.True(t, ok, "missing vendor for %s", pricing.ModelName)
		switch pricing.ModelName {
		case "[Cloud]MiMo-V2.5-Pro", "xiaomi/mimo-v2-flash":
			assert.Equal(t, "小米", vendor.Name)
			assert.Equal(t, "XiaomiMiMo", vendor.Icon)
		case "[AN]NAI-diffusion-4.5-full", "novelai/nai-diffusion-4-curated-preview":
			assert.Equal(t, "NovelAI", vendor.Name)
			assert.Equal(t, "NovelAI", vendor.Icon)
		default:
			assert.Equal(t, "阶跃星辰", vendor.Name)
			assert.Equal(t, "Stepfun", vendor.Icon)
		}
		if pricing.ModelName == "step-3.5-flash" {
			assert.Equal(t, "Saved description", pricing.Description)
		}
	}
}

func TestPricingDoesNotTreatOpenAICompatibleAsNAI(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertPricingEndpointChannel(t, 104, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 104, "openai-compatible-model")
	InitChannelCache()
	pricings := GetPricing()
	require.Len(t, pricings, 1)
	assert.Zero(t, pricings[0].VendorID)
}

func TestPricingPreservesConfiguredVendorAndIcon(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertPricingEndpointChannel(t, 102, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 102, "mimo-custom")
	vendor := &Vendor{Name: "Custom vendor", Icon: "CustomIcon", Status: 1}
	require.NoError(t, vendor.Insert())
	require.NoError(t, DB.Create(&Model{ModelName: "mimo-custom", VendorID: vendor.Id, Icon: "CustomModelIcon", Status: 1}).Error)
	InitChannelCache()
	pricings := GetPricing()
	require.Len(t, pricings, 1)
	assert.Equal(t, vendor.Id, pricings[0].VendorID)
	assert.Equal(t, "CustomModelIcon", pricings[0].Icon)
}

func TestPricingSharedMetadataInfersEachVendorAndReusesExistingAlias(t *testing.T) {
	resetPricingEndpointTestTables(t)
	insertPricingEndpointChannel(t, 103, constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{})
	insertPricingEndpointAbility(t, 103, "[Cloud]mimo-v2-flash")
	insertPricingEndpointAbility(t, 103, "[Cloud]step-3.5-flash")
	stepfun := &Vendor{Name: "StepFun", Status: 1}
	require.NoError(t, stepfun.Insert())
	require.NoError(t, DB.Create(&Model{ModelName: "[Cloud]", NameRule: NameRulePrefix, Icon: "CustomIcon", Status: 1}).Error)
	InitChannelCache()
	pricings := GetPricing()
	require.Len(t, pricings, 2)
	for _, pricing := range pricings {
		assert.Equal(t, "CustomIcon", pricing.Icon)
		if pricing.ModelName == "[Cloud]step-3.5-flash" {
			assert.Equal(t, stepfun.Id, pricing.VendorID)
		} else {
			assert.NotZero(t, pricing.VendorID)
			assert.NotEqual(t, stepfun.Id, pricing.VendorID)
		}
	}
	assert.Len(t, GetVendors(), 2)
}

func TestVendorDefaultsSupplyMissingIconsWithoutOverwritingCustomIcons(t *testing.T) {
	resetPricingEndpointTestTables(t)
	for _, vendor := range []Vendor{
		{Name: "小米", Status: 1},
		{Name: "StepFun", Status: 1},
		{Name: "Xiaomi", Icon: "CustomIcon", Status: 1},
	} {
		require.NoError(t, vendor.Insert())
	}
	vendors, err := GetAllVendors(0, 10)
	require.NoError(t, err)
	icons := make(map[string]string)
	for _, vendor := range vendors {
		icons[vendor.Name] = vendor.Icon
	}
	assert.Equal(t, "XiaomiMiMo", icons["小米"])
	assert.Equal(t, "Stepfun", icons["StepFun"])
	assert.Equal(t, "CustomIcon", icons["Xiaomi"])
}
