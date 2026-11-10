package service

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func StartRankingSnapshotUpdater() {
	if !common.IsMasterNode {
		return
	}
	go func() {
		for {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			catchingUp, err := model.RefreshRankingSnapshot(ctx, time.Now())
			cancel()
			if err != nil {
				common.SysError("ranking snapshot refresh failed: " + err.Error())
			}
			if err == nil && catchingUp {
				time.Sleep(time.Second)
				continue
			}
			if err == nil {
				rankingCacheMu.Lock()
				periods := make([]string, 0, len(rankingCache))
				for period, item := range rankingCache {
					item.expiresAt = time.Time{}
					rankingCache[period] = item
					periods = append(periods, period)
				}
				rankingCacheMu.Unlock()
				for _, period := range periods {
					_, _ = GetRankingsSnapshot(period)
				}
			}
			time.Sleep(rankingCacheTTL)
		}
	}()
}
