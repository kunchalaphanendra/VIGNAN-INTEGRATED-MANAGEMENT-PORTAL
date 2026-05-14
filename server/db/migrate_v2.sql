-- ═══════════════════════════════════════════════════════════════
-- VIMP(AG) Migration v2
-- Run this on an EXISTING vignan_portal database to add new tables
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ═══════════════════════════════════════════════════════════════

USE vignan_portal;

-- 1. ACADEMIC CALENDAR (Working Day Registry per Department)
CREATE TABLE IF NOT EXISTS academic_calendar (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  department_id    INT NOT NULL,
  academic_year_id INT NOT NULL,
  calendar_date    DATE NOT NULL,
  day_type         ENUM('working','holiday','exam','event','compensatory') NOT NULL DEFAULT 'working',
  label            VARCHAR(255),
  classes_count    INT DEFAULT 0,
  created_by       INT NOT NULL,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dept_date (department_id, calendar_date),
  FOREIGN KEY (department_id)    REFERENCES departments(id)    ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)       REFERENCES users(id)
) ENGINE=InnoDB;

-- 2. ATTENDANCE SESSIONS (Per-Class Period Tracker)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id    INT NOT NULL,
  session_date     DATE NOT NULL,
  period_number    TINYINT NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           ENUM('scheduled','conducted','cancelled') DEFAULT 'scheduled',
  cancelled_reason VARCHAR(255),
  created_by       INT NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session (assignment_id, session_date, period_number),
  FOREIGN KEY (assignment_id) REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)    REFERENCES users(id)
) ENGINE=InnoDB;

-- 3. ALTER ATTENDANCE: add session_id column (safe, only adds if missing)
SET @dbname = DATABASE();
SET @tablename = 'attendance';
SET @columnname = 'session_id';
SET @preparedStatement = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME   = @tablename
        AND COLUMN_NAME  = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN session_id INT NULL AFTER assignment_id')
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add FK only if not already present
SET @fkname = 'fk_att_session';
SET @preparedFK = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA    = @dbname
        AND TABLE_NAME      = @tablename
        AND CONSTRAINT_NAME = @fkname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @fkname, ' FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE SET NULL')
  )
);
PREPARE fkIfNotExists FROM @preparedFK;
EXECUTE fkIfNotExists;
DEALLOCATE PREPARE fkIfNotExists;

-- 4. ATTENDANCE SUMMARY (Cached Aggregates)
CREATE TABLE IF NOT EXISTS attendance_summary (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  student_id        INT NOT NULL,
  assignment_id     INT NOT NULL,
  academic_year_id  INT NOT NULL,
  total_sessions    INT DEFAULT 0,
  attended_sessions INT DEFAULT 0,
  percentage        DECIMAL(5,2) DEFAULT 0.00,
  last_updated      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_summary (student_id, assignment_id, academic_year_id),
  FOREIGN KEY (student_id)       REFERENCES users(id)               ON DELETE CASCADE,
  FOREIGN KEY (assignment_id)    REFERENCES faculty_assignments(id)  ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)      ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. CROSS DEPT TEACHING VIEW
CREATE OR REPLACE VIEW cross_dept_teaching AS
SELECT
  fa.id             AS assignment_id,
  u.id              AS faculty_id,
  u.full_name       AS faculty_name,
  u.department_id   AS home_dept_id,
  d_home.name       AS home_dept_name,
  fa.department_id  AS teaching_dept_id,
  d_teach.name      AS teaching_dept_name,
  s.name            AS subject_name,
  s.code            AS subject_code,
  fa.year,
  fa.section
FROM faculty_assignments fa
JOIN users u             ON u.id = fa.faculty_id
JOIN departments d_home  ON d_home.id = u.department_id
JOIN departments d_teach ON d_teach.id = fa.department_id
JOIN subjects s          ON s.id = fa.subject_id
WHERE u.department_id != fa.department_id;

-- 6. CLASS PERIODS (HOD configures daily period schedule)
CREATE TABLE IF NOT EXISTS class_periods (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  department_id       INT NOT NULL,
  period_number       TINYINT NOT NULL,
  label               VARCHAR(50),          -- e.g. "Class 1", "Period 2"
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  window_open_before  TINYINT DEFAULT 5,    -- minutes before start: attendance opens
  window_close_after  TINYINT DEFAULT 10,   -- minutes after start: attendance closes
  is_active           BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uq_dept_period (department_id, period_number),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SELECT 'Migration v2 complete! Tables added: academic_calendar, attendance_sessions, attendance_summary, class_periods. View added: cross_dept_teaching.' AS result;

