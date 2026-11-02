package controller

import (
	"net/url"
	"testing"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func confirmPaymentComplianceForTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestStripeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeWebhookSecret = ""
	setting.StripeApiSecret = "sk_test_123"
	setting.StripePriceId = "price_123"
	require.False(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = "whsec_test"
	require.True(t, isStripeWebhookEnabled())

	setting.StripePriceId = ""
	require.False(t, isStripeWebhookEnabled())
}

func TestCreemWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
	})

	setting.CreemWebhookSecret = ""
	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = `[{"productId":"prod_123"}]`
	require.False(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = "creem_secret"
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = "[]"
	require.False(t, isCreemWebhookEnabled())
}

func TestWaffoWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	originalSandboxAPIKey := setting.WaffoSandboxApiKey
	originalSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	originalSandboxPublicCert := setting.WaffoSandboxPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
		setting.WaffoSandboxApiKey = originalSandboxAPIKey
		setting.WaffoSandboxPrivateKey = originalSandboxPrivateKey
		setting.WaffoSandboxPublicCert = originalSandboxPublicCert
	})

	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = ""
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoApiKey = "api"
	require.True(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = false
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = true
	setting.WaffoSandbox = true
	setting.WaffoSandboxApiKey = ""
	setting.WaffoSandboxPrivateKey = "sandbox_private"
	setting.WaffoSandboxPublicCert = "sandbox_public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoSandboxApiKey = "sandbox_api"
	require.True(t, isWaffoWebhookEnabled())
}

func TestWaffoPancakeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalProductID := setting.WaffoPancakeProductID
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeProductID = originalProductID
	})

	// Presence of all three credentials enables the gateway. Webhook public
	// keys are bundled in the SDK and there is no separate Enabled toggle —
	// clear any of the three fields to disable.
	setting.WaffoPancakeMerchantID = ""
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeProductID = "product"
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeMerchantID = "merchant"
	require.True(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = "product"
	setting.WaffoPancakePrivateKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())
}

func TestEpayWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.False(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = "epay_key"
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = nil
	require.False(t, isEpayWebhookEnabled())
}

func configureSplitEpayForTest(t *testing.T) {
	t.Helper()
	confirmPaymentComplianceForTest(t)
	for _, config := range []struct {
		target *string
		value  string
	}{
		{&operation_setting.PayAddress, "https://default.example.test"},
		{&operation_setting.EpayId, "1001"},
		{&operation_setting.EpayKey, "default-local-test"},
		{&operation_setting.EpayAlipayAddress, "https://alipay.example.test"},
		{&operation_setting.EpayAlipayId, "2001"},
		{&operation_setting.EpayAlipayKey, "alipay-local-test"},
		{&operation_setting.EpayWxpayAddress, "https://wechat.example.test"},
		{&operation_setting.EpayWxpayId, "3001"},
		{&operation_setting.EpayWxpayKey, "wechat-local-test"},
	} {
		previous := *config.target
		t.Cleanup(func() { *config.target = previous })
		*config.target = config.value
	}
}

func TestEpayIndependentGatewaysGenerateSeparatePayments(t *testing.T) {
	configureSplitEpayForTest(t)
	callback, err := url.Parse("https://api.example.test/api/user/epay/notify")
	require.NoError(t, err)
	for _, tc := range []struct{ method, address, merchant string }{
		{"alipay", "https://alipay.example.test/submit.php", "2001"},
		{"wxpay", "https://wechat.example.test/submit.php", "3001"},
		{"custom1", "https://default.example.test/submit.php", "1001"},
	} {
		t.Run(tc.method, func(t *testing.T) {
			client := GetEpayClient(operation_setting.SelectEpayGateway(tc.method))
			require.NotNil(t, client)
			address, params, err := client.Purchase(&epay.PurchaseArgs{Type: tc.method, ServiceTradeNo: "local-order", Money: "10.00", NotifyUrl: callback, ReturnUrl: callback})
			require.NoError(t, err)
			require.Equal(t, tc.address, address)
			require.Equal(t, tc.merchant, params["pid"])
		})
	}
	operation_setting.PayAddress = ""
	require.True(t, isEpayMethodConfigured("alipay"), "independent platforms do not need a default")
	require.True(t, isEpayMethodConfigured("wxpay"))
	operation_setting.EpayAlipayKey = ""
	require.False(t, isEpayMethodConfigured("alipay"), "partial credentials must not fall back to another platform")
	require.True(t, isEpayMethodConfigured("wxpay"))
}

func TestEpayCallbacksUseTheOrdersGateway(t *testing.T) {
	configureSplitEpayForTest(t)
	for _, tc := range []struct {
		name, gateway, signer, method, merchant, amount string
		valid                                           bool
	}{
		{"alipay", "alipay", "alipay", "alipay", "2001", "10.00", true},
		{"wechat", "wxpay", "wxpay", "wxpay", "3001", "10.00", true},
		{"existing_default_order", "", "", "alipay", "1001", "10.00", true},
		{"other_gateway", "alipay", "wxpay", "alipay", "2001", "10.00", false},
		{"wrong_merchant", "alipay", "alipay", "alipay", "3001", "10.00", false},
		{"wrong_method", "alipay", "alipay", "wxpay", "2001", "10.00", false},
		{"wrong_amount", "alipay", "alipay", "alipay", "2001", "1.00", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			params := epay.GenerateParams(map[string]string{
				"out_trade_no": "local-order", "pid": tc.merchant, "type": tc.method,
				"money": tc.amount, "trade_status": epay.StatusTradeSuccess,
			}, operation_setting.GetEpayGateway(tc.signer).Key)
			_, err := verifyEpayPayment(params, tc.gateway, "local-order", 10)
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
