package ratio_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// ModelDiscount is catalog metadata on a 0–10 scale, never a billing multiplier.
var modelDiscountMap = types.NewRWMap[string, float64]()

func ValidateModelDiscountJSON(value string) error {
	var discounts map[string]float64
	if err := common.UnmarshalJsonStr(value, &discounts); err != nil {
		return fmt.Errorf("invalid model discounts: %w", err)
	}
	if discounts == nil {
		return fmt.Errorf("model discounts must be a JSON object")
	}
	for name, discount := range discounts {
		if strings.TrimSpace(name) == "" || discount <= 0 || discount > 10 {
			return fmt.Errorf("model %q: display discount must be greater than 0 and no more than 10", name)
		}
	}
	return nil
}

func UpdateModelDiscountByJSONString(value string) error {
	if err := ValidateModelDiscountJSON(value); err != nil {
		return err
	}
	return types.LoadFromJsonString(modelDiscountMap, value)
}

func ModelDiscount2JSONString() string {
	return modelDiscountMap.MarshalJSONString()
}

func GetModelDiscount(model string) (float64, bool) {
	return modelDiscountMap.Get(model)
}
