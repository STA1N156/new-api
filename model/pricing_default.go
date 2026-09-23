package model

import (
	"regexp"
	"strings"
)

var naiModelPattern = regexp.MustCompile(`(?i)(?:^|[^a-z0-9])nai(?:[-_]|$)`)

// 简化的供应商映射规则
var defaultVendorRules = map[string]string{
	"gpt":      "OpenAI",
	"dall-e":   "OpenAI",
	"whisper":  "OpenAI",
	"o1":       "OpenAI",
	"o3":       "OpenAI",
	"claude":   "Anthropic",
	"gemini":   "Google",
	"moonshot": "Moonshot",
	"kimi":     "Moonshot",
	"chatglm":  "智谱",
	"glm-":     "智谱",
	"qwen":     "阿里巴巴",
	"deepseek": "DeepSeek",
	"abab":     "MiniMax",
	"minimax":  "MiniMax",
	"mimo":     "小米",
	"step-":    "阶跃星辰",
	"stepfun":  "阶跃星辰",
	"novelai":  "NovelAI",
	"ernie":    "百度",
	"spark":    "讯飞",
	"hunyuan":  "腾讯",
	"command":  "Cohere",
	"@cf/":     "Cloudflare",
	"360":      "360",
	"yi":       "零一万物",
	"jina":     "Jina",
	"mistral":  "Mistral",
	"grok":     "xAI",
	"llama":    "Meta",
	"doubao":   "字节跳动",
	"kling":    "快手",
	"jimeng":   "即梦",
	"vidu":     "Vidu",
}

// 供应商默认图标映射
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Claude.Color",
	"Google":     "Gemini.Color",
	"Moonshot":   "Moonshot",
	"智谱":         "Zhipu.Color",
	"阿里巴巴":       "Qwen.Color",
	"DeepSeek":   "DeepSeek.Color",
	"MiniMax":    "Minimax.Color",
	"小米":         "XiaomiMiMo",
	"阶跃星辰":       "Stepfun",
	"NovelAI":    "NovelAI",
	"百度":         "Wenxin.Color",
	"讯飞":         "Spark.Color",
	"腾讯":         "Hunyuan.Color",
	"Cohere":     "Cohere.Color",
	"Cloudflare": "Cloudflare.Color",
	"360":        "Ai360.Color",
	"零一万物":       "Yi.Color",
	"Jina":       "Jina",
	"Mistral":    "Mistral.Color",
	"xAI":        "XAI",
	"Meta":       "Ollama",
	"字节跳动":       "Doubao.Color",
	"快手":         "Kling.Color",
	"即梦":         "Jimeng.Color",
	"Vidu":       "Vidu",
	"微软":         "AzureAI",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		meta := metaMap[modelName]
		if meta != nil && meta.VendorID != 0 {
			continue
		}

		// 匹配供应商
		vendorID := 0
		modelLower := strings.ToLower(modelName)
		for pattern, vendorName := range defaultVendorRules {
			if strings.Contains(modelLower, pattern) {
				vendorID = getOrCreateVendor(vendorName, vendorMap)
				break
			}
		}
		if vendorID == 0 && naiModelPattern.MatchString(modelName) {
			vendorID = getOrCreateVendor("NovelAI", vendorMap)
		}

		if meta != nil {
			// 规则可能供多个模型共用，复制后补充供应商，保留原有展示设置。
			resolved := *meta
			resolved.VendorID = vendorID
			metaMap[modelName] = &resolved
		} else {
			metaMap[modelName] = &Model{
				ModelName: modelName,
				VendorID:  vendorID,
				Status:    1,
				NameRule:  NameRuleExact,
			}
		}
	}
}

// 查找或创建供应商
func getOrCreateVendor(vendorName string, vendorMap map[int]*Vendor) int {
	icon := getDefaultVendorIcon(vendorName)
	// 查找现有供应商
	for id, vendor := range vendorMap {
		sameBrand := (icon == "XiaomiMiMo" || icon == "Stepfun") && getDefaultVendorIcon(vendor.Name) == icon
		if strings.EqualFold(vendor.Name, vendorName) || sameBrand {
			return id
		}
	}

	// 创建新供应商
	newVendor := &Vendor{
		Name:   vendorName,
		Status: 1,
		Icon:   icon,
	}

	if err := newVendor.Insert(); err != nil {
		return 0
	}

	vendorMap[newVendor.Id] = newVendor
	return newVendor.Id
}

// 获取供应商默认图标
func getDefaultVendorIcon(vendorName string) string {
	switch strings.ToLower(strings.TrimSpace(vendorName)) {
	case "xiaomi", "mimo", "xiaomimimo", "小米":
		vendorName = "小米"
	case "stepfun", "阶跃星辰":
		vendorName = "阶跃星辰"
	case "novelai":
		vendorName = "NovelAI"
	}
	return defaultVendorIcons[vendorName]
}
