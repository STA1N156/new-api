package controller

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetDailyStatistics(c *gin.Context) {
	days, err := strconv.Atoi(c.DefaultQuery("days", "1"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": model.ErrStatisticsDate.Error()})
		return
	}
	statistics, err := model.GetDailyStatistics(c.Query("date"), time.Now(), days)
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
