package controllers

import (
	"a1ctf/src/db/models"
	"a1ctf/src/tasks"
	dbtool "a1ctf/src/utils/db_tool"
	general "a1ctf/src/utils/general"
	i18ntool "a1ctf/src/utils/i18n_tool"
	"a1ctf/src/webmodels"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"gorm.io/gorm"
)

func AdminListUsers(c *gin.Context) {

	var payload webmodels.AdminListUsersPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "InvalidRequestPayload"})})
		return
	}

	query := dbtool.DB().Model(&models.User{})

	// 如果有搜索关键词，添加搜索条件
	if payload.Search != "" {
		searchPattern := fmt.Sprintf("%%%s%%", payload.Search)
		query = query.Where(`username ILIKE ? 
		OR email ILIKE ? OR realname ILIKE ? 
		OR student_number ILIKE ?
		OR slogan ILIKE ?
		OR user_id::text = ?
		OR last_login_ip = ?
		OR register_ip = ?`,
			searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, payload.Search, payload.Search, payload.Search)
	}

	var users []models.User
	if err := query.Offset(payload.Offset).Limit(payload.Size).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToFetchUsers"})})
		return
	}

	var count int64
	countQuery := dbtool.DB().Model(&models.User{})
	if payload.Search != "" {
		searchPattern := fmt.Sprintf("%%%s%%", payload.Search)
		countQuery = countQuery.Where(`username ILIKE ? 
		OR email ILIKE ? OR realname ILIKE ? 
		OR student_number ILIKE ?
		OR slogan ILIKE ?
		OR user_id::text = ?
		OR last_login_ip = ?
		OR register_ip = ?`,
			searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, payload.Search, payload.Search, payload.Search)
	}
	if err := countQuery.Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToCountUsers"})})
		return
	}

	userItems := make([]webmodels.AdminListUserItem, 0, len(users))

	for _, user := range users {
		userItems = append(userItems, webmodels.AdminListUserItem{
			UserID:        user.UserID,
			UserName:      user.Username,
			RealName:      user.Realname,
			StudentID:     user.StudentNumber,
			Phone:         user.Phone,
			Slogan:        user.Slogan,
			RegisterTime:  user.RegisterTime,
			LastLoginTime: user.LastLoginTime,
			LastLoginIP:   user.LastLoginIP,
			Email:         user.Email,
			Avatar:        user.Avatar,
			Role:          user.Role,
			EmailVerified: user.EmailVerified,
			RegisterIP:    user.RegisterIP,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":  200,
		"data":  userItems,
		"total": count,
	})
}

// AdminUpdateUser 更新用户信息
func AdminUpdateUser(c *gin.Context) {
	var payload webmodels.AdminUpdateUserPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "InvalidRequestParameters"}),
		})
		return
	}

	// 先检查用户是否存在
	var user models.User
	if err := dbtool.DB().First(&user, "user_id = ?", payload.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UserNotFound"}),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToQueryUser"}),
			})
		}
		return
	}

	// 更新用户信息
	user.Username = payload.UserName
	user.Realname = payload.RealName
	user.StudentNumber = payload.StudentID
	user.Phone = payload.Phone
	user.Slogan = payload.Slogan
	user.Email = payload.Email
	user.Avatar = payload.Avatar

	// 如果用户的角色被修改了，则需要重置这个用户的令牌
	if user.Role != payload.Role {
		// 无权修改管理员的角色
		if user.Role == models.UserRoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UpdateAdminRoleNotAllowed"}),
			})
			return
		}
		user.JWTVersion = general.RandomPassword(16)
		user.Role = payload.Role
	}

	if err := dbtool.DB().Save(&user).Error; err != nil {
		// 记录失败日志
		tasks.LogAdminOperationWithError(c, models.ActionUpdate, models.ResourceTypeUser, &payload.UserID, payload, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToUpdateUserInfo"}),
		})
		return
	}

	// 记录成功日志
	tasks.LogAdminOperation(c, models.ActionUpdate, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
		"updated_fields": []string{"username", "realname", "student_number", "phone", "slogan", "email", "avatar", "role"},
		"old_username":   user.Username,
		"new_username":   payload.UserName,
	})

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UserInfoUpdated"}),
	})
}

// AdminResetUserPassword 重置用户密码
func AdminResetUserPassword(c *gin.Context) {
	var payload webmodels.AdminUserOperationPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "InvalidRequestParameters"}),
		})
		return
	}

	// 先检查用户是否存在
	var user models.User
	if err := dbtool.DB().First(&user, "user_id = ?", payload.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UserNotFound"}),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToQueryUser"}),
			})
		}
		return
	}

	// 生成新密码
	newPassword := general.RandomPassword(16)
	newSalt := general.GenerateSalt()
	saltedPassword := general.SaltPassword(newPassword, newSalt)

	// 更新用户密码
	user.Password = saltedPassword
	user.Salt = newSalt
	// 作废老令牌
	user.JWTVersion = general.RandomPassword(16)

	if err := dbtool.DB().Save(&user).Error; err != nil {
		// 记录失败日志
		tasks.LogAdminOperationWithError(c, models.ActionResetPassword, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
			"target_user": user.Username,
		}, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToResetPassword"}),
		})
		return
	}

	// 记录成功日志
	tasks.LogAdminOperation(c, models.ActionResetPassword, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
		"target_user": user.Username,
		"action":      "password_reset_success",
	})

	c.JSON(http.StatusOK, gin.H{
		"code":         200,
		"message":      i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "PasswordReset"}),
		"new_password": newPassword,
	})
}

// AdminDeleteUser 删除用户
func AdminDeleteUser(c *gin.Context) {
	var payload webmodels.AdminUserOperationPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "InvalidRequestParameters"}),
		})
		return
	}

	// 开始事务
	tx := dbtool.DB().Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 先检查用户是否存在
	var user models.User
	if err := tx.First(&user, "user_id = ?", payload.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    404,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UserNotFound"}),
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToQueryUser"}),
			})
		}
		tx.Rollback()
		return
	}

	// 不能删除管理员账户
	if user.Role == models.UserRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{
			"code":    403,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "DeleteAdminNotAllowed"}),
		})
		return
	}

	// 删除用户
	if err := tx.Delete(&user).Error; err != nil {
		tx.Rollback()

		// 记录失败日志
		tasks.LogAdminOperationWithError(c, models.ActionDelete, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
			"target_user": user.Username,
		}, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToDeleteUser"}),
		})
		return
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		// 记录失败日志
		tasks.LogAdminOperationWithError(c, models.ActionDelete, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
			"target_user": user.Username,
			"error_type":  "commit_transaction_failed",
		}, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "FailedToCommitTransaction"}),
		})
		return
	}

	// 记录成功日志
	tasks.LogAdminOperation(c, models.ActionDelete, models.ResourceTypeUser, &payload.UserID, map[string]interface{}{
		"deleted_user": user.Username,
		"action":       "user_delete_success",
	})

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": i18ntool.Translate(c, &i18n.LocalizeConfig{MessageID: "UserDeleted"}),
	})
}
