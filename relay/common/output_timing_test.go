package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestOutputTimingIgnoresNonOutputFrames(t *testing.T) {
	for _, frame := range []string{
		`{"choices":[{"delta":{"role":"assistant","content":""}}]}`,
		`{"choices":[],"usage":{"completion_tokens":100}}`,
		`{"type":"response.completed","response":{"output":[{"content":[{"text":"done"}]}]}}`,
		`{"type":"content_block_delta","delta":{"type":"signature_delta","signature":"abc"}}`,
		`{"type":"message_stop"}`, `{"type":"ping"}`, `[DONE]`,
	} {
		info := &RelayInfo{firstOutputTime: time.Unix(10, 0), lastOutputTime: time.Unix(12, 0)}
		info.ObserveStreamOutput(frame)
		assert.Equal(t, 2*time.Second, info.OutputDuration(), frame)
		info.ResetOutputTiming()
		assert.Zero(t, info.OutputDuration())
	}
}

func TestOutputTimingIncludesTextReasoningAndTools(t *testing.T) {
	for _, frame := range []string{
		`{"choices":[{"delta":{"content":"hello"}}]}`,
		`{"choices":[{"delta":{"reasoning_content":"think"}}]}`,
		`{"choices":[{"delta":{"tool_calls":[{"function":{"arguments":"{}"}}]}}]}`,
		`{"type":"content_block_delta","delta":{"thinking":"think"}}`,
		`{"type":"content_block_delta","delta":{"partial_json":"{}"}}`,
		`{"type":"response.output_text.delta","delta":"hello"}`,
		`{"type":"response.function_call_arguments.delta","delta":"{}"}`,
		`{"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}`,
		`{"message":{"content":"hello"}}`,
	} {
		info := &RelayInfo{}
		info.ObserveStreamOutput(frame)
		assert.False(t, info.firstOutputTime.IsZero(), frame)
		assert.Equal(t, info.firstOutputTime, info.lastOutputTime, frame)
	}
}
