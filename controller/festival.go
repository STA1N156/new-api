package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"net/http"
)

func GetFestival(c *gin.Context) {
	status, err := model.GetFestivalStatus(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": status})
}

func DrawFestival(c *gin.Context) {
	var request struct {
		RequestID string `json:"request_id" binding:"required,min=16,max=64"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "Invalid draw request")
		return
	}
	draw, err := model.DrawFestival(c.GetInt("id"), request.RequestID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": draw})
}
