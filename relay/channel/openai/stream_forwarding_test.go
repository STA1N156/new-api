package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type firstTextRecorder struct {
	*httptest.ResponseRecorder
	firstText chan struct{}
	once      sync.Once
}

func (w *firstTextRecorder) Flush() {
	w.ResponseRecorder.Flush()
	if strings.Contains(w.Body.String(), `"content":"hello"`) {
		w.once.Do(func() { close(w.firstText) })
	}
}

func TestOaiStreamForwardsTextBeforeNextUpstreamChunk(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	w := &firstTextRecorder{ResponseRecorder: httptest.NewRecorder(), firstText: make(chan struct{})}
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	reader, writer := io.Pipe()
	resp := &http.Response{StatusCode: http.StatusOK, Body: reader, Header: make(http.Header)}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayMode:          relayconstant.RelayModeChatCompletions,
		RelayFormat:        types.RelayFormatOpenAI,
		IsStream:           true,
		DisablePing:        true,
		ShouldIncludeUsage: true,
	}
	releaseTail := make(chan struct{})
	var releaseOnce sync.Once
	finished := make(chan struct{})
	var usage *dto.Usage
	var streamErr *types.NewAPIError
	t.Cleanup(func() {
		releaseOnce.Do(func() { close(releaseTail) })
		_ = reader.Close()
		_ = writer.Close()
		select {
		case <-finished:
		case <-time.After(5 * time.Second):
			t.Error("stream handler did not stop")
		}
	})
	go func() {
		defer writer.Close()
		_, err := io.WriteString(writer, "data: "+`{"id":"chat-test","model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello"}}]}`+"\n\n")
		if err != nil {
			return
		}
		<-releaseTail
		_, _ = io.WriteString(writer, "data: "+`{"id":"chat-test","model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`+"\n\ndata: "+`{"id":"chat-test","model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`+"\n\ndata: [DONE]\n\n")
	}()
	go func() {
		usage, streamErr = OaiStreamHandler(c, info, resp)
		close(finished)
	}()
	select {
	case <-w.firstText:
	case <-time.After(2 * time.Second):
		t.Fatal("first text was held until the next upstream chunk")
	}
	releaseOnce.Do(func() { close(releaseTail) })
	select {
	case <-finished:
	case <-time.After(5 * time.Second):
		t.Fatal("stream did not complete")
	}
	require.Nil(t, streamErr)
	require.Equal(t, 5, usage.TotalTokens)
	require.Equal(t, 1, strings.Count(w.Body.String(), `"content":"hello"`))
	require.Equal(t, 1, strings.Count(w.Body.String(), `"usage"`))
	require.Equal(t, 1, strings.Count(w.Body.String(), "data: [DONE]"))
}

func TestOaiStreamImmediateTextPreservesFinalFrames(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, tc := range []struct {
		name         string
		chunks       []string
		includeUsage bool
		usageFrames  int
	}{
		{
			name: "usage stays hidden when not requested",
			chunks: []string{
				`{"id":"chat-test","model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello"}}]}`,
				`{"id":"chat-test","model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
				`{"id":"chat-test","model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
			},
		},
		{
			name: "text and usage in the same final chunk are sent once",
			chunks: []string{
				`{"id":"chat-test","model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
			},
			includeUsage: true,
			usageFrames:  1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := "data: " + strings.Join(tc.chunks, "\n\ndata: ") + "\n\ndata: [DONE]\n\n"
			c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
			info.RelayMode = relayconstant.RelayModeChatCompletions
			info.ShouldIncludeUsage = tc.includeUsage
			usage, err := OaiStreamHandler(c, info, resp)
			require.Nil(t, err)
			require.Equal(t, 2, usage.PromptTokens)
			require.Equal(t, 3, usage.CompletionTokens)
			require.Equal(t, 1, strings.Count(recorder.Body.String(), `"content":"hello"`))
			require.Equal(t, tc.usageFrames, strings.Count(recorder.Body.String(), `"usage"`))
			require.Equal(t, 1, strings.Count(recorder.Body.String(), `"finish_reason":"stop"`))
			require.Equal(t, 1, strings.Count(recorder.Body.String(), "data: [DONE]"))
		})
	}
}
