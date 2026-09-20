package controller

import (
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetDailyStatistics(c *gin.Context) {
	statistics, err := model.GetDailyStatistics(c.Query("date"), time.Now())
	if errors.Is(err, model.ErrStatisticsDate) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, statistics)
}
