package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCaptureResponseModel(t *testing.T) {
	for _, tc := range []struct {
		name, payload, want string
	}{
		{"openai", `{"model":"gpt-actual","choices":[]}`, "gpt-actual"},
		{"claude stream", `{"type":"message_start","message":{"model":"claude-actual"}}`, "claude-actual"},
		{"responses stream", `{"type":"response.created","response":{"model":"gpt-actual"}}`, "gpt-actual"},
		{"gemini", `{"modelVersion":"gemini-actual","candidates":[]}`, "gemini-actual"},
		{"request alias", `{"model":"requested"}`, ""},
		{"mapped alias", `{"model":"mapped"}`, ""},
		{"explicit version matching request", `{"modelVersion":"requested","model":"mapped"}`, "requested"},
		{"nested version", `{"response":{"model":"mapped","model_version":"gemini-version"}}`, "gemini-version"},
		{"image", `{"model":"image-actual","data":[{"b64_json":"image"}]}`, "image-actual"},
		{"missing", `{"choices":[]}`, ""},
		{"invalid", `not json`, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &RelayInfo{OriginModelName: "requested", ChannelMeta: &ChannelMeta{UpstreamModelName: "mapped"}}
			info.CaptureResponseModel([]byte(tc.payload))
			assert.Equal(t, tc.want, info.ResponseModelName)
			assert.Equal(t, "mapped", info.UpstreamModelName)
			info.CaptureResponseModel([]byte(`{"choices":[]}`))
			assert.Equal(t, tc.want, info.ResponseModelName)
		})
	}
}

func TestCaptureResponseModelPrefersLaterVersion(t *testing.T) {
	info := &RelayInfo{OriginModelName: "requested", ChannelMeta: &ChannelMeta{UpstreamModelName: "mapped"}}
	info.CaptureResponseModel([]byte(`{"model":"response-alias"}`))
	assert.Equal(t, "response-alias", info.ResponseModelName)
	info.CaptureResponseModel([]byte(`{"modelVersion":"gemini-version"}`))
	assert.Equal(t, "gemini-version", info.ResponseModelName)
	assert.Equal(t, "gemini-version", info.ResponseModelVersion)
	info.CaptureResponseModel([]byte(`{"model":"response-alias"}`))
	assert.Equal(t, "gemini-version", info.ResponseModelName)
}
