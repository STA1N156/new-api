package perfmetrics

import (
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestStreamSpeedExcludesWaitingAfterOutput(t *testing.T) {
	info := &relaycommon.RelayInfo{
		IsStream: true, StartTime: time.Now().Add(-time.Minute),
		FirstResponseTime: time.Now().Add(-50 * time.Second),
	}
	info.ObserveStreamOutput(`{"choices":[{"delta":{"content":"hello"}}]}`)
	info.ObserveStreamOutput(`{"choices":[{"delta":{"content":"world"}}]}`)
	sample := NewRelaySample(info, true, 100)
	assert.Equal(t, info.OutputDuration().Milliseconds(), sample.GenerationMs)
	assert.EqualValues(t, 100, sample.OutputTokens)
	assert.GreaterOrEqual(t, sample.LatencyMs, int64(60000))

	// A single bulk chunk has no measurable output interval; never substitute
	// the connection lifetime and publish a misleading speed.
	info.ResetOutputTiming()
	info.ObserveStreamOutput(`{"choices":[{"delta":{"content":"bulk response"}}]}`)
	assert.Zero(t, NewRelaySample(info, true, 100).GenerationMs)
}
