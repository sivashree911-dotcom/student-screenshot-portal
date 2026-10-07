-- ==============================================================================
-- STUDENT SCREENSHOT PORTAL - DATABASE SCHEMA
-- Target Engine: MySQL 8.0+ / Aiven MySQL
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `student_screenshot_portal`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `student_screenshot_portal`;

-- 1. Administrators Table
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Students Reference Table
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `register_number` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150),
  `department` VARCHAR(100),
  `year` VARCHAR(10),
  `section` VARCHAR(10),
  `status` VARCHAR(50) DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_students_reg` (`register_number`)
) ENGINE=InnoDB;

-- 3. Hackathons Table
CREATE TABLE IF NOT EXISTS `hackathons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `institution` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `registration_deadline` DATE NOT NULL,
  `mode` ENUM('Online', 'Offline', 'Hybrid') NOT NULL DEFAULT 'Offline',
  `location` VARCHAR(255),
  `min_team_size` INT NOT NULL DEFAULT 1,
  `max_team_size` INT NOT NULL DEFAULT 5,
  `allow_external_participants` BOOLEAN NOT NULL DEFAULT FALSE,
  `registration_url` TEXT NOT NULL,
  `poster_path` VARCHAR(500),
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_hackathon_active` (`is_active`),
  INDEX `idx_hackathon_dates` (`start_date`, `end_date`, `registration_deadline`)
) ENGINE=InnoDB;

-- 4. Submissions Table
CREATE TABLE IF NOT EXISTS `submissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `submission_id` VARCHAR(50) NOT NULL UNIQUE,
  `student_register_number` VARCHAR(50) NOT NULL,
  `student_name` VARCHAR(150) NULL,
  `student_email` VARCHAR(150) NULL,
  `hackathon_id` INT NOT NULL,
  `screenshot_path` VARCHAR(500) NOT NULL,
  `status` ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
  `rejection_reason` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE,
  INDEX `idx_sub_student_reg` (`student_register_number`),
  INDEX `idx_sub_student_email` (`student_email`),
  INDEX `idx_sub_hackathon` (`hackathon_id`),
  INDEX `idx_sub_status` (`status`)
) ENGINE=InnoDB;

-- 5. Teams Table
CREATE TABLE IF NOT EXISTS `teams` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `submission_id` INT NOT NULL,
  `team_size` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Team Members Table
CREATE TABLE IF NOT EXISTS `team_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `register_number` VARCHAR(50) NULL,
  `name` VARCHAR(150) NOT NULL,
  `department` VARCHAR(100) NULL,
  `year` VARCHAR(10) NULL,
  `section` VARCHAR(10) NULL,
  `member_type` ENUM('College', 'External') NOT NULL DEFAULT 'College',
  `institution` VARCHAR(255) NULL,
  `email` VARCHAR(150) NULL,
  `is_captain` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  INDEX `idx_tm_reg_no` (`register_number`),
  INDEX `idx_tm_type` (`member_type`),
  INDEX `idx_tm_captain` (`is_captain`)
) ENGINE=InnoDB;

-- 7. Settings Table
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
