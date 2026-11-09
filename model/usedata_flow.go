package model

import (
	"context"
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
)

type FlowQuotaData struct {
	UserID      int    `json:"user_id,omitempty" gorm:"column:user_id"`
	Username    string `json:"username,omitempty" gorm:"column:username"`
	NodeName    string `json:"node_name,omitempty" gorm:"column:node_name"`
	TokenID     int    `json:"token_id,omitempty" gorm:"column:token_id"`
	TokenName   string `json:"token_name,omitempty" gorm:"-"`
	UseGroup    string `json:"use_group" gorm:"column:use_group"`
	ChannelID   int    `json:"channel_id,omitempty" gorm:"column:channel_id"`
	ChannelName string `json:"channel_name,omitempty" gorm:"-"`
	ModelName   string `json:"model_name" gorm:"column:model_name"`
	TokenUsed   int    `json:"token_used" gorm:"column:token_used"`
	Count       int    `json:"count" gorm:"column:count"`
	Quota       int    `json:"quota" gorm:"column:quota"`
}

func GetFlowQuotaData(ctx context.Context, start, end int64, username string, userID int, role int) ([]*FlowQuotaData, error) {
	dimensions := "token_id, " + logGroupColumn() + " AS use_group, model_name"
	if role >= common.RoleAdminUser {
		dimensions = "user_id, username, " + logGroupColumn() + " AS use_group, model_name, channel_id"
		userID = 0
		if role >= common.RoleRootUser {
			dimensions += ", token_id"
			node := "COALESCE(json_extract(NULLIF(other, ''), '$.admin_info.node_name'), '')"
			switch common.LogDatabaseType() {
			case common.DatabaseTypeMySQL:
				node = "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NULLIF(other, ''), '$.admin_info.node_name')), '')"
			case common.DatabaseTypePostgreSQL:
				node = "COALESCE(NULLIF(other, '')::jsonb #>> '{admin_info,node_name}', '')"
			case common.DatabaseTypeClickHouse:
				node = "JSONExtractString(other, 'admin_info', 'node_name')"
			}
			dimensions += ", " + node + " AS node_name"
		}
	} else {
		if userID <= 0 {
			return nil, fmt.Errorf("invalid user")
		}
		username = ""
	}
	data, err := queryQuotaLogs(ctx, start, end, username, userID, dimensions, true)
	if err != nil {
		return nil, err
	}
	rows := make([]*FlowQuotaData, 0, len(data))
	for _, item := range data {
		rows = append(rows, &FlowQuotaData{
			UserID: item.UserID, Username: item.Username, TokenID: item.TokenID, NodeName: item.NodeName,
			UseGroup: item.UseGroup, ModelName: item.ModelName, ChannelID: item.ChannelID,
			TokenUsed: item.TokenUsed, Count: item.Count, Quota: item.Quota,
		})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Quota > rows[j].Quota })
	if role < common.RoleAdminUser || role >= common.RoleRootUser {
		if err := fillFlowTokenNames(rows); err != nil {
			return nil, err
		}
	}
	if role >= common.RoleAdminUser {
		if err := fillFlowChannelNames(rows); err != nil {
			return nil, err
		}
	}
	return rows, nil
}

func fillFlowTokenNames(rows []*FlowQuotaData) error {
	tokenIDSet := make(map[int]struct{})
	tokenIDs := make([]int, 0)
	for _, row := range rows {
		if row.TokenID == 0 {
			continue
		}
		if _, ok := tokenIDSet[row.TokenID]; ok {
			continue
		}
		tokenIDSet[row.TokenID] = struct{}{}
		tokenIDs = append(tokenIDs, row.TokenID)
	}
	if len(tokenIDs) == 0 {
		return nil
	}

	var tokens []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Model(&Token{}).Select("id, name").Where("id IN ?", tokenIDs).Find(&tokens).Error; err != nil {
		return err
	}
	tokenNameByID := make(map[int]string, len(tokens))
	for _, token := range tokens {
		tokenNameByID[token.Id] = token.Name
	}
	// Deleted tokens are intentionally not resolved here: leave TokenName empty
	// so the frontend can render a localized "deleted (id)" label instead.
	for _, row := range rows {
		if name := tokenNameByID[row.TokenID]; name != "" {
			row.TokenName = name
		}
	}
	return nil
}

func fillFlowChannelNames(rows []*FlowQuotaData) error {
	channelIDSet := make(map[int]struct{})
	channelIDs := make([]int, 0)
	for _, row := range rows {
		if row.ChannelID == 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}

	channelNameByID := make(map[int]string, len(channelIDs))
	if common.MemoryCacheEnabled {
		for _, channelID := range channelIDs {
			if channel, err := CacheGetChannel(channelID); err == nil {
				channelNameByID[channelID] = channel.Name
			}
		}
	} else {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			channelNameByID[channel.Id] = channel.Name
		}
	}
	for _, row := range rows {
		if name := channelNameByID[row.ChannelID]; name != "" {
			row.ChannelName = name
			continue
		}
		if row.ChannelID > 0 {
			row.ChannelName = fmt.Sprintf("channel-%d", row.ChannelID)
		}
	}
	return nil
}
