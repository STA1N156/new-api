package common

import (
	"strings"
	"time"

	"github.com/tidwall/gjson"
)

// ObserveStreamOutput timestamps upstream output before downstream writes or
// conversion. Usage, signatures, keepalives and completion events do not count.
func (info *RelayInfo) ObserveStreamOutput(data string) {
	receivedAt := time.Now()
	frame := gjson.Parse(data)
	hasOutput := false
	switch event := frame.Get("type").String(); {
	case strings.HasPrefix(event, "response."):
		switch event {
		case "response.output_text.delta", "response.reasoning_text.delta",
			"response.reasoning_summary_text.delta", "response.function_call_arguments.delta",
			"response.refusal.delta", "response.audio.delta", "response.output_audio.delta":
			hasOutput = frame.Get("delta").String() != ""
		}
	case event == "content_block_delta":
		delta := frame.Get("delta")
		hasOutput = delta.Get("text").String() != "" || delta.Get("thinking").String() != "" || delta.Get("partial_json").String() != ""
	case event == "content_block_start":
		block := frame.Get("content_block")
		hasOutput = block.Get("text").String() != "" || block.Get("thinking").String() != ""
	case frame.Get("choices").IsArray():
		frame.Get("choices").ForEach(func(_, choice gjson.Result) bool {
			delta := choice.Get("delta")
			hasOutput = choice.Get("text").String() != "" || delta.Get("content").String() != "" ||
				delta.Get("reasoning_content").String() != "" || delta.Get("reasoning").String() != "" ||
				delta.Get("refusal").String() != "" || delta.Get("function_call.arguments").String() != "" ||
				delta.Get("function_call.name").String() != "" || delta.Get("audio.data").String() != ""
			delta.Get("tool_calls").ForEach(func(_, tool gjson.Result) bool {
				hasOutput = hasOutput || tool.Get("function.arguments").String() != "" || tool.Get("function.name").String() != ""
				return !hasOutput
			})
			return !hasOutput
		})
	case frame.Get("candidates").IsArray():
		frame.Get("candidates").ForEach(func(_, candidate gjson.Result) bool {
			candidate.Get("content.parts").ForEach(func(_, part gjson.Result) bool {
				hasOutput = part.Get("text").String() != "" || part.Get("functionCall").IsObject() || part.Get("inlineData.data").String() != ""
				return !hasOutput
			})
			return !hasOutput
		})
	case frame.Get("message").IsObject(): // Ollama
		hasOutput = frame.Get("message.content").String() != "" || frame.Get("message.thinking").String() != "" || frame.Get("message.tool_calls.#").Int() > 0
	case frame.Get("response").Type == gjson.String: // Ollama generate
		hasOutput = frame.Get("response").String() != ""
	case frame.Get("event_type").String() == "text-generation": // Cohere
		hasOutput = frame.Get("text").String() != ""
	case frame.Get("event").String() == "message" || frame.Get("event").String() == "agent_message": // Dify
		hasOutput = frame.Get("answer").String() != ""
	case frame.Get("result").Type == gjson.String: // Baidu
		hasOutput = frame.Get("result").String() != ""
	}
	if !hasOutput {
		return
	}
	info.outputTimingMu.Lock()
	defer info.outputTimingMu.Unlock()
	if info.firstOutputTime.IsZero() {
		info.firstOutputTime = receivedAt
	}
	info.lastOutputTime = receivedAt
}

func (info *RelayInfo) OutputDuration() time.Duration {
	info.outputTimingMu.Lock()
	defer info.outputTimingMu.Unlock()
	return info.lastOutputTime.Sub(info.firstOutputTime)
}

// ResetOutputTiming separates retries so a failed attempt cannot lengthen the next sample.
func (info *RelayInfo) ResetOutputTiming() {
	info.outputTimingMu.Lock()
	defer info.outputTimingMu.Unlock()
	info.firstOutputTime = time.Time{}
	info.lastOutputTime = time.Time{}
}
