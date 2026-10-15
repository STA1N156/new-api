package common

import "github.com/QuantumNous/new-api/common"

// CaptureResponseModel reads upstream metadata before any response conversion.
// A missing model stays missing; a mapped request name is not a response model.
func (info *RelayInfo) CaptureResponseModel(data []byte) {
	if info.ResponseModelVersion != "" {
		return
	}
	type modelMetadata struct {
		Model             string `json:"model"`
		ModelVersion      string `json:"modelVersion"`
		ModelVersionSnake string `json:"model_version"`
	}
	var response struct {
		modelMetadata
		Message  modelMetadata `json:"message"`
		Response modelMetadata `json:"response"`
	}
	if common.Unmarshal(data, &response) != nil {
		return
	}
	for _, metadata := range []modelMetadata{response.modelMetadata, response.Message, response.Response} {
		version := metadata.ModelVersion
		if version == "" {
			version = metadata.ModelVersionSnake
		}
		if version != "" {
			info.ResponseModelVersion = version
			info.ResponseModelName = version
			return
		}
	}
	if info.ResponseModelName != "" {
		return
	}
	for _, model := range []string{response.Model, response.Message.Model, response.Response.Model} {
		if model == "" || model == info.OriginModelName || (info.ChannelMeta != nil && model == info.UpstreamModelName) {
			continue
		}
		info.ResponseModelName = model
		return
	}
}
