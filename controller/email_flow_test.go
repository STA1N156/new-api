package controller

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Receive one message over SMTP, without contacting an external mail service.
func receiveTestEmail(t *testing.T) <-chan string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	oldHost, oldPort, oldFrom := common.SMTPServer, common.SMTPPort, common.SMTPFrom
	oldAccount, oldToken := common.SMTPAccount, common.SMTPToken
	oldSSL, oldStartTLS := common.SMTPSSLEnabled, common.SMTPStartTLSEnabled
	t.Cleanup(func() {
		common.SMTPServer, common.SMTPPort, common.SMTPFrom = oldHost, oldPort, oldFrom
		common.SMTPAccount, common.SMTPToken = oldAccount, oldToken
		common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = oldSSL, oldStartTLS
	})
	common.SMTPServer, common.SMTPPort = "127.0.0.1", listener.Addr().(*net.TCPAddr).Port
	common.SMTPFrom, common.SMTPAccount, common.SMTPToken = "sender@example.com", "", ""
	common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = false, false
	messages := make(chan string, 1)
	go func() {
		defer close(messages)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		smtp := textproto.NewConn(conn)
		if smtp.PrintfLine("220 localhost ready") != nil {
			return
		}
		for {
			command, err := smtp.ReadLine()
			if err != nil {
				return
			}
			if command == "DATA" {
				if smtp.PrintfLine("354 send message") != nil {
					return
				}
				message, err := smtp.ReadDotBytes()
				if err != nil {
					return
				}
				messages <- string(message)
			}
			if command == "QUIT" {
				_ = smtp.PrintfLine("221 bye")
				return
			}
			if smtp.PrintfLine("250 OK") != nil {
				return
			}
		}
	}()
	return messages
}

func TestAccountEmailFlows(t *testing.T) {
	for _, flow := range []string{"register", "bind", "reset"} {
		t.Run(flow, func(t *testing.T) {
			db := setupManageUserTestDB(t)
			oldRegister, oldPasswordRegister := common.RegisterEnabled, common.PasswordRegisterEnabled
			oldVerify, oldDomain, oldAlias := common.EmailVerificationEnabled, common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled
			oldDefaultToken := constant.GenerateDefaultToken
			t.Cleanup(func() {
				common.RegisterEnabled, common.PasswordRegisterEnabled = oldRegister, oldPasswordRegister
				common.EmailVerificationEnabled, common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled = oldVerify, oldDomain, oldAlias
				constant.GenerateDefaultToken = oldDefaultToken
			})
			common.RegisterEnabled, common.PasswordRegisterEnabled, common.EmailVerificationEnabled = true, true, true
			common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled, constant.GenerateDefaultToken = false, true, false
			email := "12345678@qq.com"
			if flow == "reset" {
				// Restrictions on new email addresses must not lock out existing accounts.
				email = "ash1278@qq.com"
			}
			t.Cleanup(func() {
				common.DeleteKey(email, common.EmailVerificationPurpose)
				common.DeleteKey(email, common.PasswordResetPurpose)
			})
			user := model.User{Username: "mail-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
			if flow == "reset" {
				user.Email = email
			}
			if flow != "register" {
				require.NoError(t, db.Create(&user).Error)
			}

			messages := receiveTestEmail(t)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/verification?email="+email, nil)
			if flow == "reset" {
				SendPasswordResetEmail(c)
			} else {
				SendEmailVerification(c)
			}
			require.Contains(t, recorder.Body.String(), `"success":true`)
			message := <-messages
			require.Contains(t, message, "To: "+email)

			recorder = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(recorder)
			if flow == "reset" {
				match := regexp.MustCompile(`<a href='([^']+)'`).FindStringSubmatch(message)
				require.Len(t, match, 2)
				link, err := url.Parse(match[1])
				require.NoError(t, err)
				body := fmt.Sprintf(`{"email":%q,"token":%q}`, email, link.Query().Get("token"))
				c.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(body))
				ResetPassword(c)
			} else {
				match := regexp.MustCompile(`<strong>([^<]+)</strong>`).FindStringSubmatch(message)
				require.Len(t, match, 2)
				body := fmt.Sprintf(`{"username":"mail-user","password":"NewPassword123","email":%q,"verification_code":%q,"code":%q}`, email, match[1], match[1])
				c.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(body))
				c.Set("id", user.Id)
				if flow == "register" {
					Register(c)
				} else {
					EmailBind(c)
				}
			}
			require.Contains(t, recorder.Body.String(), `"success":true`)
			var saved model.User
			require.NoError(t, db.Where("username = ?", "mail-user").First(&saved).Error)
			assert.Equal(t, email, saved.Email)
			if flow == "reset" {
				var response struct{ Data string }
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
				assert.True(t, common.ValidatePasswordAndHash(response.Data, saved.Password))
			}
		})
	}
}
