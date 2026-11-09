package model

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/samber/hot"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

// Keep the legacy table and its history; new dashboard data comes from logs.
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;default:0"`
	NodeName  string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type quotaQueryKey struct {
	db         *gorm.DB
	start, end int64
	username   string
	userID     int
	dimensions string
	flow       bool
}

var quotaQueryCache = hot.NewHotCache[quotaQueryKey, []*QuotaData](hot.LRU, 16).
	WithTTL(time.Minute).Build()
var quotaQueries singleflight.Group

func queryQuotaLogs(ctx context.Context, start, end int64, username string, userID int, dimensions string, flow bool) ([]*QuotaData, error) {
	if start <= 0 || end < start {
		return nil, errors.New("请选择有效的时间范围")
	}
	key := quotaQueryKey{LOG_DB, start, end, username, userID, dimensions, flow}
	if rows, ok, _ := quotaQueryCache.Get(key); ok {
		return rows, nil
	}
	result := quotaQueries.DoChan(fmt.Sprintf("%v", key), func() (any, error) {
		if rows, ok, _ := quotaQueryCache.Get(key); ok {
			return rows, nil
		}
		query := LOG_DB.Model(&Log{}).
			Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, start, end)
		if userID > 0 {
			query = query.Where("user_id = ?", userID)
		}
		if username != "" {
			query = query.Where("username = ?", username)
		}
		if flow {
			query = query.Where(logGroupColumn() + " <> ''")
		}
		rows := make([]*QuotaData, 0)
		err := query.Select(dimensions + ", COUNT(*) AS count, SUM(quota) AS quota, SUM(prompt_tokens + completion_tokens) AS token_used").
			Group(strings.NewReplacer(" AS created_at", "", " AS use_group", "", " AS node_name", "").Replace(dimensions)).Scan(&rows).Error
		if err != nil {
			return nil, fmt.Errorf("统计查询未完成，请缩短时间范围后重试: %w", err)
		}
		quotaQueryCache.Set(key, rows)
		return rows, nil
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case value := <-result:
		if value.Err != nil {
			return nil, value.Err
		}
		return value.Val.([]*QuotaData), nil
	}
}

func logGroupColumn() string {
	if common.UsingLogDatabase(common.DatabaseTypePostgreSQL) {
		return "\"group\""
	}
	return "`group`"
}

const quotaHourDimensions = "model_name, created_at - (created_at % 3600) AS created_at"

func GetQuotaDataByUsername(ctx context.Context, username string, start, end int64) ([]*QuotaData, error) {
	return queryQuotaLogs(ctx, start, end, username, 0, quotaHourDimensions, false)
}

func GetQuotaDataByUserId(ctx context.Context, userID int, start, end int64) ([]*QuotaData, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user")
	}
	return queryQuotaLogs(ctx, start, end, "", userID, quotaHourDimensions, false)
}

func GetQuotaDataGroupByUser(ctx context.Context, start, end int64) ([]*QuotaData, error) {
	return queryQuotaLogs(ctx, start, end, "", 0, "username, created_at - (created_at % 3600) AS created_at", false)
}

func GetAllQuotaDates(ctx context.Context, start, end int64, username string) ([]*QuotaData, error) {
	return GetQuotaDataByUsername(ctx, username, start, end)
}
