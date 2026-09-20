package model

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

var ErrSubscriptionModelNotAllowed = errors.New("no active subscription supports this model")

// SubscriptionModels lists exact public model names; nil/empty keeps legacy plans unrestricted.
type SubscriptionModels []string

func (models SubscriptionModels) Value() (driver.Value, error) {
	if len(models) == 0 {
		return nil, nil
	}
	data, err := common.Marshal(models)
	return string(data), err
}

func (models *SubscriptionModels) Scan(value interface{}) error {
	*models = nil
	switch v := value.(type) {
	case nil:
		return nil
	case []byte:
		return common.Unmarshal(v, models)
	case string:
		return common.UnmarshalJsonStr(v, models)
	default:
		return fmt.Errorf("invalid subscription models: %T", value)
	}
}

func (models SubscriptionModels) Allows(modelName string) bool {
	return len(models) == 0 || slices.Contains(models, modelName)
}

func (p *SubscriptionPlan) ValidateAllowedModels() error {
	if p.AllowedModels == nil {
		return nil // Older clients omit this field when updating a plan.
	}
	models := make(SubscriptionModels, 0, len(p.AllowedModels))
	seen := make(map[string]bool, len(p.AllowedModels))
	for _, name := range p.AllowedModels {
		name = strings.TrimSpace(name)
		if name == "" {
			return errors.New("可用模型名称不能为空")
		}
		if !seen[name] {
			models = append(models, name)
			seen[name] = true
		}
	}
	p.AllowedModels = models
	return nil
}
