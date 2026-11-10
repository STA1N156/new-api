package service

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRankingsServeCachedResultWhileOneRefreshRuns(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	originalDB := model.DB
	model.DB = db
	rankingCacheMu.Lock()
	originalCache := rankingCache
	snapshot := &RankingsResponse{Models: []RankedModel{{ModelName: "cached-model", TotalTokens: 10}}}
	rankingCache = map[string]rankingCacheItem{"today": {expiresAt: time.Now().Add(-time.Second), data: snapshot}}
	rankingCacheMu.Unlock()
	entered := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	var queries atomic.Int32
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("hold-ranking-refresh", func(tx *gorm.DB) {
		if queries.Add(1) == 1 {
			close(entered)
		}
		<-release
		tx.AddError(errors.New("temporary ranking read failure"))
	}))
	t.Cleanup(func() {
		releaseOnce.Do(func() { close(release) })
		_, _, _ = rankingBuilds.Do("today", func() (any, error) { return nil, nil })
		model.DB = originalDB
		rankingCacheMu.Lock()
		rankingCache = originalCache
		rankingCacheMu.Unlock()
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	got, err := GetRankingsSnapshot("today")
	require.NoError(t, err)
	require.Same(t, snapshot, got)
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("background refresh did not start")
	}
	for i := 0; i < 10; i++ {
		got, err = GetRankingsSnapshot("today")
		require.NoError(t, err)
		require.Same(t, snapshot, got)
	}
	require.EqualValues(t, 1, queries.Load())
	releaseOnce.Do(func() { close(release) })
	_, _, _ = rankingBuilds.Do("today", func() (any, error) { return nil, nil })
	rankingCacheMu.Lock()
	cached := rankingCache["today"].data
	rankingCacheMu.Unlock()
	require.Same(t, snapshot, cached)
}
