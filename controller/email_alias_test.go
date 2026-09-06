package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQQEmailAliasRestriction(t *testing.T) {
	for _, tt := range []struct {
		email            string
		enabled, allowed bool
	}{
		{"12345678@qq.com", true, true},
		{" 12345678@QQ.COM ", true, true},
		{"ash1278@qq.com", true, false},
		{"123+456@qq.com", true, false},
		{"１２３４@qq.com", true, false},
		{"ash1278@example.com", true, true},
		{"a.b@example.com", true, false},
		{"ash1278@qq.com", false, true},
	} {
		t.Run(fmt.Sprintf("%s/enabled=%t", tt.email, tt.enabled), func(t *testing.T) {
			setupManageUserTestDB(t)
			oldAlias, oldDomain := common.EmailAliasRestrictionEnabled, common.EmailDomainRestrictionEnabled
			common.EmailAliasRestrictionEnabled, common.EmailDomainRestrictionEnabled = tt.enabled, false
			t.Cleanup(func() {
				common.EmailAliasRestrictionEnabled, common.EmailDomainRestrictionEnabled = oldAlias, oldDomain
				common.DeleteKey(model.NormalizeEmail(tt.email), common.EmailVerificationPurpose)
			})
			messages := receiveTestEmail(t)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/verification?email="+url.QueryEscape(tt.email), nil)
			SendEmailVerification(c)
			var response struct{ Success bool }
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.Equal(t, tt.allowed, response.Success, recorder.Body.String())
			if tt.allowed {
				assert.Contains(t, <-messages, "To: "+model.NormalizeEmail(tt.email))
			}
		})
	}
}

func TestQQAliasCannotRegisterOrBindWithPreviouslyIssuedCode(t *testing.T) {
	for _, flow := range []string{"register", "bind"} {
		t.Run(flow, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			oldAlias, oldVerify := common.EmailAliasRestrictionEnabled, common.EmailVerificationEnabled
			oldRegister, oldPassword := common.RegisterEnabled, common.PasswordRegisterEnabled
			common.EmailAliasRestrictionEnabled, common.EmailVerificationEnabled = true, true
			common.RegisterEnabled, common.PasswordRegisterEnabled = true, true
			email := "ash1278@qq.com"
			common.RegisterVerificationCodeWithKey(email, "123456", common.EmailVerificationPurpose)
			t.Cleanup(func() {
				common.EmailAliasRestrictionEnabled, common.EmailVerificationEnabled = oldAlias, oldVerify
				common.RegisterEnabled, common.PasswordRegisterEnabled = oldRegister, oldPassword
				common.DeleteKey(email, common.EmailVerificationPurpose)
			})
			user := model.User{Username: "existing", Status: common.UserStatusEnabled}
			if flow == "bind" {
				require.NoError(t, db.Create(&user).Error)
			}
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Set("id", user.Id)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/user/"+flow, strings.NewReader(`{"username":"newfriend","password":"NewPassword123","email":"ash1278@qq.com","verification_code":"123456","code":"123456"}`))
			if flow == "register" {
				Register(c)
			} else {
				EmailBind(c)
			}
			assert.Contains(t, recorder.Body.String(), `"success":false`)
			var count int64
			require.NoError(t, db.Model(&model.User{}).Where("email = ?", email).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}
