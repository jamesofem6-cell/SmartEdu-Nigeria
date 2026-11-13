-- SmartEdu examination and mastery module.
-- ADDITIVE MIGRATION ONLY. Review and back up the live database before applying.
-- This file is NOT imported automatically and does not alter existing user records.

CREATE TABLE IF NOT EXISTS exam_programmes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_subjects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  programme_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  syllabus_version VARCHAR(80) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_programme_subject (programme_id, code),
  CONSTRAINT fk_exam_subject_programme FOREIGN KEY (programme_id) REFERENCES exam_programmes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id BIGINT UNSIGNED NOT NULL,
  topic VARCHAR(180) NOT NULL,
  subtopic VARCHAR(180) NULL,
  difficulty ENUM('foundation','developing','standard','advanced','expert') NOT NULL DEFAULT 'standard',
  question_type ENUM('single_choice','multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'single_choice',
  question_text LONGTEXT NOT NULL,
  explanation LONGTEXT NULL,
  hint TEXT NULL,
  source_label VARCHAR(180) NULL,
  source_year SMALLINT UNSIGNED NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_question_bank (subject_id, difficulty, topic, active),
  CONSTRAINT fk_exam_question_subject FOREIGN KEY (subject_id) REFERENCES exam_subjects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exam_question_author FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_question_options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  option_key VARCHAR(8) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  feedback TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_question_option (question_id, option_key),
  CONSTRAINT fk_exam_option_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  programme_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  attempt_mode ENUM('diagnostic','guided','timed','full_mock') NOT NULL DEFAULT 'diagnostic',
  difficulty VARCHAR(40) NOT NULL DEFAULT 'standard',
  question_count INT UNSIGNED NOT NULL,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  score_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  duration_seconds INT UNSIGNED NULL,
  status ENUM('in_progress','submitted','timed_out','abandoned') NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_attempts (user_id, created_at),
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_programme FOREIGN KEY (programme_id) REFERENCES exam_programmes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_subject FOREIGN KEY (subject_id) REFERENCES exam_subjects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_attempt_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  selected_option_id BIGINT UNSIGNED NULL,
  answer_text TEXT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  time_spent_seconds INT UNSIGNED NULL,
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  CONSTRAINT fk_attempt_answer_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_answer_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_answer_option FOREIGN KEY (selected_option_id) REFERENCES exam_question_options(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_topic_mastery (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  topic VARCHAR(180) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  questions_seen INT UNSIGNED NOT NULL DEFAULT 0,
  correct_answers INT UNSIGNED NOT NULL DEFAULT 0,
  mastery_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_assessed_at DATETIME NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_topic (user_id, subject_id, topic),
  CONSTRAINT fk_mastery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mastery_subject FOREIGN KEY (subject_id) REFERENCES exam_subjects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  programme_id BIGINT UNSIGNED NULL,
  subject_id BIGINT UNSIGNED NULL,
  topic VARCHAR(180) NOT NULL,
  teaching_level VARCHAR(40) NOT NULL DEFAULT 'beginner',
  learning_goal VARCHAR(80) NOT NULL DEFAULT 'explain',
  weakness_context TEXT NULL,
  lesson_content LONGTEXT NULL,
  learner_rating TINYINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tutor_user (user_id, created_at),
  CONSTRAINT fk_tutor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_programme FOREIGN KEY (programme_id) REFERENCES exam_programmes(id) ON DELETE SET NULL,
  CONSTRAINT fk_tutor_subject FOREIGN KEY (subject_id) REFERENCES exam_subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Never store result-checker PINs, passwords, or full credentials in this database.
CREATE TABLE IF NOT EXISTS result_checker_providers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exam_board VARCHAR(40) NOT NULL,
  provider_name VARCHAR(120) NOT NULL,
  integration_status ENUM('not_configured','testing','active','disabled') NOT NULL DEFAULT 'not_configured',
  provider_endpoint VARCHAR(500) NULL,
  configuration_reference VARCHAR(180) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_result_provider (exam_board, provider_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
