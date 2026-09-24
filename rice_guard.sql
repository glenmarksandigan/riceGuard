-- ============================================================
-- RiceGuard Database Schema
-- Created: 2026-03-03
-- Description: Complete database for the RiceGuard rice disease
--              monitoring and management system.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `rice_guard_db`;
USE `rice_guard_db`;

-- ============================================================
-- 1. tbl_user_type
-- Stores the types of users (Farmer, Technologist, Admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_user_type` (
    `user_type_id` INT(11) NOT NULL AUTO_INCREMENT,
    `type_name` VARCHAR(50) NOT NULL,
    `description` TEXT,
    `date_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. tbl_user
-- Stores all registered users (farmers, technologists, admins)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_user` (
    `user_id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_type_id` INT(11) NOT NULL,
    `fname` VARCHAR(50) NOT NULL,
    `lname` VARCHAR(50) NOT NULL,
    `mname` VARCHAR(50),
    `contact_number` VARCHAR(20),
    `password` VARCHAR(255) NOT NULL,
    `has_seen_demo` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    FOREIGN KEY (`user_type_id`) REFERENCES `tbl_user_type`(`user_type_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. tbl_address
-- Stores address details associated with each user
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_address` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `barangay` VARCHAR(225),
    `municipality` VARCHAR(225),
    `province` VARCHAR(225),
    `country` VARCHAR(225),
    `zip_code` VARCHAR(10),
    `date_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. tbl_disease
-- Stores all known rice diseases with symptoms
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_disease` (
    `disease_id` INT(11) NOT NULL AUTO_INCREMENT,
    `disease_name` VARCHAR(100) NOT NULL,
    `scientific_name` VARCHAR(100),
    `common_symptoms` TEXT,
    `date_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`disease_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. tbl_disease_report
-- Stores disease reports submitted by farmers or technologists
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_disease_report` (
    `report_id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `report_method` ENUM('Text', 'Photo', 'Walk-In') NOT NULL,
    `description` TEXT,
    `field_location` VARCHAR(255),
    `affected_area` DECIMAL(10,2),
    `status` ENUM('Pending', 'Verified', 'Treated') DEFAULT 'Pending',
    `reported_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`report_id`),
    FOREIGN KEY (`user_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. tbl_disease_image
-- Stores photos uploaded as evidence for each disease report
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_disease_image` (
    `image_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`image_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. tbl_ai_diagnosis
-- Stores AI/ML-generated diagnoses based on uploaded photos
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_ai_diagnosis` (
    `ai_diagnosis_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `disease_id` INT(11) NOT NULL,
    `confidence_score` DECIMAL(5,2),
    `model_version` VARCHAR(50),
    `diagnosed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`ai_diagnosis_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`disease_id`) REFERENCES `tbl_disease`(`disease_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. tbl_verification
-- Stores verification records from technologist field inspections
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_verification` (
    `verification_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `user_id` INT(11) NOT NULL,
    `disease_id` INT(11) NOT NULL,
    `verification_method` ENUM('Photo', 'Field Visit') NOT NULL,
    `notes` TEXT,
    `verified_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`verification_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (`disease_id`) REFERENCES `tbl_disease`(`disease_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. tbl_treatment
-- Stores standard treatment options for each rice disease
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_treatment` (
    `treatment_id` INT(11) NOT NULL AUTO_INCREMENT,
    `disease_id` INT(11) NOT NULL,
    `treatment_type` ENUM('Chemical', 'Biological', 'Cultural', 'Integrated') NOT NULL,
    `pesticide_name` VARCHAR(100),
    `dosage` VARCHAR(100),
    `application_method` TEXT,
    `estimated_cost` DECIMAL(10,2),
    `date_created` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`treatment_id`),
    FOREIGN KEY (`disease_id`) REFERENCES `tbl_disease`(`disease_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. tbl_treatment_recommendation
-- Stores treatment recommendations issued to farmers
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_treatment_recommendation` (
    `recommendation_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `treatment_id` INT(11) NOT NULL,
    `recommended_by` INT(11) NOT NULL,
    `recommendation_source` ENUM('Technologist', 'AI System') NOT NULL,
    `additional_notes` TEXT,
    `recommended_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`recommendation_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`treatment_id`) REFERENCES `tbl_treatment`(`treatment_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (`recommended_by`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. tbl_insurance_claim
-- Stores insurance claim records submitted by farmers
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_insurance_claim` (
    `claim_id` INT(11) NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) NOT NULL,
    `report_id` INT(11) NOT NULL,
    `rsbsa_num` VARCHAR(50),
    `policy_num` VARCHAR(50),
    `damage_type` VARCHAR(50),
    `rejection_reason` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('Pending', 'Verified', 'Paid', 'Rejected') DEFAULT 'Pending',
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`claim_id`),
    FOREIGN KEY (`user_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11b. tbl_claim_image
-- Stores proof photos uploaded by farmers for insurance claims
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_claim_image` (
    `claim_image_id` INT(11) NOT NULL AUTO_INCREMENT,
    `claim_id` INT(11) NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `image_type` ENUM('Field Damage', 'Affected Area', 'Supporting Document', 'Other') DEFAULT 'Other',
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`claim_image_id`),
    FOREIGN KEY (`claim_id`) REFERENCES `tbl_insurance_claim`(`claim_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. tbl_disease_stats
-- Stores aggregated statistics on rice disease cases per period
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_disease_stats` (
    `stat_id` INT(11) NOT NULL AUTO_INCREMENT,
    `disease_id` INT(11) NOT NULL,
    `period` VARCHAR(50) NOT NULL,
    `total_cases` INT(11) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`stat_id`),
    FOREIGN KEY (`disease_id`) REFERENCES `tbl_disease`(`disease_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Default Data: User Types
-- ============================================================
INSERT INTO `tbl_user_type` (`type_name`, `description`) VALUES
('Farmer', 'A registered farmer who can submit disease reports, view diagnoses, receive treatment recommendations, and file insurance claims.'),
('Technologist', 'An agricultural technologist who can verify disease reports through field visits, confirm diagnoses, and issue treatment recommendations.'),
('Admin', 'A system administrator who manages users, oversees all reports and verifications, and has full access to system analytics and settings.');

-- ============================================================
-- Default Data: Common Rice Diseases
-- ============================================================
INSERT INTO `tbl_disease` (`disease_name`, `scientific_name`, `common_symptoms`) VALUES
('Bacterial Leaf Blight', 'Xanthomonas oryzae pv. oryzae', 'Water-soaked to yellowish lesions on leaf margins that enlarge and turn white to gray. Leaves dry out and wilt.'),
('Rice Blast', 'Magnaporthe oryzae', 'Diamond-shaped lesions with gray centers and brown borders on leaves. Can also affect stems and panicles.'),
('Brown Spot', 'Bipolaris oryzae', 'Oval brown spots on leaves with gray or white centers. Severe infection leads to seedling blight.'),
('Sheath Blight', 'Rhizoctonia solani', 'Oval or irregular greenish-gray lesions on the leaf sheath near the waterline. Lesions expand and may cover entire tillers.'),
('Tungro', 'Rice tungro bacilliform virus & Rice tungro spherical virus', 'Stunted growth, yellow-orange leaf discoloration, reduced tillering, and delayed flowering.'),
('Rice Grassy Stunt', 'Rice grassy stunt virus', 'Severe stunting, excessive tillering with narrow and pale green leaves, and reduced or no panicle production.'),
('Leaf Scald', 'Microdochium oryzae', 'Zonate lesions with alternating light tan and dark brown bands on leaf tips or margins. Tips appear scalded.'),
('Narrow Brown Spot', 'Cercospora janseana', 'Short, narrow, linear brown lesions on leaves. Lesions may coalesce, causing browning of larger leaf areas.');

-- ============================================================
-- 13. tbl_field_visit_request
-- Stores field visit requests submitted by farmers
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_field_visit_request` (
    `visit_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `farmer_id` INT(11) NOT NULL,
    `tech_id` INT(11) DEFAULT NULL,
    `reason` TEXT,
    `preferred_date` DATE DEFAULT NULL,
    `status` ENUM('Pending','Accepted','Completed','Declined') DEFAULT 'Pending',
    `farmer_notes` TEXT,
    `tech_notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`visit_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`farmer_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`tech_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. tbl_visit_image
-- Stores proof photos uploaded by farmers for field visit requests
-- ============================================================
CREATE TABLE IF NOT EXISTS `tbl_visit_image` (
    `visit_image_id` INT(11) NOT NULL AUTO_INCREMENT,
    `visit_id` INT(11) NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`visit_image_id`),
    FOREIGN KEY (`visit_id`) REFERENCES `tbl_field_visit_request`(`visit_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
