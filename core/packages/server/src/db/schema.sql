-- NOTE: 训练器数据库 schema
-- 在云服务器 MariaDB 上执行此文件创建数据库和表

CREATE DATABASE IF NOT EXISTS trainer_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE trainer_db;

-- 训练结果表：每次计时一条记录
CREATE TABLE IF NOT EXISTS train_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL COMMENT 'WCA ID 或匿名 UUID',
  alg_set_id VARCHAR(50) NOT NULL COMMENT '公式集 ID, 如 "3x3-pll"',
  case_id VARCHAR(20) NOT NULL COMMENT 'Case ID, 如 "Aa"',
  time_ms INT UNSIGNED NOT NULL COMMENT '计时（毫秒）',
  correct BOOLEAN DEFAULT TRUE COMMENT '识别是否正确（识别模式）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_set (user_id, alg_set_id),
  INDEX idx_user_case (user_id, alg_set_id, case_id)
) ENGINE=InnoDB;

-- 用户设置表：JSON 存储用户偏好
CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(20) PRIMARY KEY COMMENT 'WCA ID 或匿名 UUID',
  settings JSON NOT NULL COMMENT '用户设置 JSON',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- WCA 用户信息缓存
CREATE TABLE IF NOT EXISTS wca_users (
  wca_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  access_token VARCHAR(500) COMMENT '加密存储的 WCA access token',
  refresh_token VARCHAR(500),
  token_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
