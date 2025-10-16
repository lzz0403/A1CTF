package main

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// 数据库连接配置
const (
	host     = "localhost"
	port     = 5432
	user     = "your_username"
	password = "your_password"
	dbname   = "a1ctf"
)

// Team 模型结构体
type Team struct {
	TeamID  int64  `gorm:"column:team_id;primaryKey"`
	GameID  int64  `gorm:"column:game_id"`
	GroupID *int64 `gorm:"column:group_id"`
	// 其他字段...
}

// GameGroup 模型结构体
type GameGroup struct {
	GroupID   int64  `gorm:"column:group_id;primaryKey"`
	GameID    int64  `gorm:"column:game_id"`
	GroupName string `gorm:"column:group_name"`
	// 其他字段...
}

// 查询结果结构体
type TeamGroupResult struct {
	TeamID    int64   `json:"team_id"`
	GameID    int64   `json:"game_id"`
	GroupID   *int64  `json:"group_id"`
	GroupName *string `json:"group_name"`
}

func main() {
	// 连接数据库
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	// 示例查询参数
	gameID := int64(1)
	teamID := int64(100)

	// 方法1: 使用原生SQL查询
	result1 := queryWithRawSQL(db, gameID, teamID)
	fmt.Printf("原生SQL查询结果: %+v\n", result1)

	// 方法2: 使用GORM JOIN查询
	result2 := queryWithGORMJoin(db, gameID, teamID)
	fmt.Printf("GORM JOIN查询结果: %+v\n", result2)

	// 方法3: 使用GORM预加载查询
	result3 := queryWithGORMPreload(db, gameID, teamID)
	fmt.Printf("GORM预加载查询结果: %+v\n", result3)

	// 方法4: 分步查询
	result4 := queryStepByStep(db, gameID, teamID)
	fmt.Printf("分步查询结果: %+v\n", result4)
}

// 方法1: 使用原生SQL查询
func queryWithRawSQL(db *gorm.DB, gameID, teamID int64) *TeamGroupResult {
	var result TeamGroupResult
	
	sql := `
		SELECT 
			t.team_id,
			t.game_id,
			t.group_id,
			gg.group_name
		FROM teams t
		LEFT JOIN game_groups gg ON t.group_id = gg.group_id
		WHERE t.game_id = ? AND t.team_id = ?
	`
	
	err := db.Raw(sql, gameID, teamID).Scan(&result).Error
	if err != nil {
		log.Printf("原生SQL查询失败: %v", err)
		return nil
	}
	
	return &result
}

// 方法2: 使用GORM JOIN查询
func queryWithGORMJoin(db *gorm.DB, gameID, teamID int64) *TeamGroupResult {
	var result TeamGroupResult
	
	err := db.Table("teams t").
		Select("t.team_id, t.game_id, t.group_id, gg.group_name").
		Joins("LEFT JOIN game_groups gg ON t.group_id = gg.group_id").
		Where("t.game_id = ? AND t.team_id = ?", gameID, teamID).
		Scan(&result).Error
	
	if err != nil {
		log.Printf("GORM JOIN查询失败: %v", err)
		return nil
	}
	
	return &result
}

// 方法3: 使用GORM预加载查询
func queryWithGORMPreload(db *gorm.DB, gameID, teamID int64) *TeamGroupResult {
	var team Team
	
	// 定义带关联的Team结构体
	type TeamWithGroup struct {
		Team
		Group *GameGroup `gorm:"foreignKey:GroupID;references:GroupID"`
	}
	
	var teamWithGroup TeamWithGroup
	
	err := db.Preload("Group").
		Where("game_id = ? AND team_id = ?", gameID, teamID).
		First(&teamWithGroup).Error
	
	if err != nil {
		log.Printf("GORM预加载查询失败: %v", err)
		return nil
	}
	
	result := &TeamGroupResult{
		TeamID:  teamWithGroup.TeamID,
		GameID:  teamWithGroup.GameID,
		GroupID: teamWithGroup.GroupID,
	}
	
	if teamWithGroup.Group != nil {
		result.GroupName = &teamWithGroup.Group.GroupName
	}
	
	return result
}

// 方法4: 分步查询
func queryStepByStep(db *gorm.DB, gameID, teamID int64) *TeamGroupResult {
	// 第一步：查询team获取group_id
	var team Team
	err := db.Where("game_id = ? AND team_id = ?", gameID, teamID).First(&team).Error
	if err != nil {
		log.Printf("查询team失败: %v", err)
		return nil
	}
	
	result := &TeamGroupResult{
		TeamID:  team.TeamID,
		GameID:  team.GameID,
		GroupID: team.GroupID,
	}
	
	// 第二步：如果有group_id，查询group_name
	if team.GroupID != nil {
		var gameGroup GameGroup
		err := db.Where("group_id = ?", *team.GroupID).First(&gameGroup).Error
		if err != nil {
			log.Printf("查询game_group失败: %v", err)
		} else {
			result.GroupName = &gameGroup.GroupName
		}
	}
	
	return result
}

// 批量查询多个team的group_name
func queryMultipleTeams(db *gorm.DB, gameID int64, teamIDs []int64) []TeamGroupResult {
	var results []TeamGroupResult
	
	sql := `
		SELECT 
			t.team_id,
			t.game_id,
			t.group_id,
			gg.group_name
		FROM teams t
		LEFT JOIN game_groups gg ON t.group_id = gg.group_id
		WHERE t.game_id = ? AND t.team_id IN ?
		ORDER BY t.team_id
	`
	
	err := db.Raw(sql, gameID, teamIDs).Scan(&results).Error
	if err != nil {
		log.Printf("批量查询失败: %v", err)
		return nil
	}
	
	return results
}

// 表名设置
func (Team) TableName() string {
	return "teams"
}

func (GameGroup) TableName() string {
	return "game_groups"
}