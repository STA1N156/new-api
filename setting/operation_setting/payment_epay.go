package operation_setting

import (
	"net/url"
	"strings"
)

var EpayAlipayAddress, EpayAlipayId, EpayAlipayKey string
var EpayWxpayAddress, EpayWxpayId, EpayWxpayKey string

type EpayGatewayConfig struct {
	Address, MerchantID, Key string
}

func GetEpayGateway(gateway string) EpayGatewayConfig {
	var config EpayGatewayConfig
	switch gateway {
	case "":
		config = EpayGatewayConfig{PayAddress, EpayId, EpayKey}
	case "alipay":
		config = EpayGatewayConfig{EpayAlipayAddress, EpayAlipayId, EpayAlipayKey}
	case "wxpay":
		config = EpayGatewayConfig{EpayWxpayAddress, EpayWxpayId, EpayWxpayKey}
	}
	config.Address = strings.TrimSpace(config.Address)
	config.MerchantID = strings.TrimSpace(config.MerchantID)
	config.Key = strings.TrimSpace(config.Key)
	return config
}

func (config EpayGatewayConfig) Configured() bool {
	address, err := url.Parse(config.Address)
	return err == nil && address.Host != "" &&
		(address.Scheme == "http" || address.Scheme == "https") &&
		config.MerchantID != "" && config.Key != ""
}

// An empty dedicated address uses the legacy default. Never mix credentials
// from different platforms when a dedicated configuration is incomplete.
func SelectEpayGateway(paymentMethod string) string {
	if paymentMethod == "alipay" || paymentMethod == "wxpay" {
		if GetEpayGateway(paymentMethod).Address != "" {
			return paymentMethod
		}
	}
	return ""
}
