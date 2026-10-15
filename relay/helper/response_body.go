package helper

import (
	"io"
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func ReadResponseBody(resp *http.Response, info *relaycommon.RelayInfo) ([]byte, error) {
	body, err := io.ReadAll(resp.Body)
	if err == nil {
		info.CaptureResponseModel(body)
	}
	return body, err
}
