package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetBakingState(c *gin.Context) {
	state, err := model.GetBakingState(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, state)
}

func BakingAction(c *gin.Context) {
	var command model.BakingCommand
	if err := c.ShouldBindJSON(&command); err != nil || command.Version < 0 || command.RoundID < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid baking request"})
		return
	}
	action := c.Param("action")
	if action != "start" && action != "bake" && action != "claim" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Invalid baking request"})
		return
	}
	state, err := model.ExecuteBakingAction(c.GetInt("id"), action, command)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, state)
}
