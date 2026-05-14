CREATE DATABASE IF NOT EXISTS vignan_portal;
USE vignan_portal;

-- DEPARTMENTS
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- USERS (unified table for all roles)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('principal','hod','faculty','student') NOT NULL,
  department_id INT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  profile_photo VARCHAR(255),
  theme_preference ENUM('light','dark') DEFAULT 'light',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- FACULTY PROFILES
CREATE TABLE faculty_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  designation VARCHAR(100),
  qualification VARCHAR(150),
  joining_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- STUDENT PROFILES
CREATE TABLE student_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  roll_number VARCHAR(30) NOT NULL UNIQUE,
  year INT NOT NULL,
  semester INT NOT NULL,
  section VARCHAR(10),
  department_id INT NOT NULL,
  parent_name VARCHAR(150),
  parent_phone VARCHAR(20),
  parent_email VARCHAR(150),
  date_of_birth DATE,
  address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- ACADEMIC YEARS
CREATE TABLE academic_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(20) NOT NULL,
  is_current BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

-- SUBJECTS
CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  semester INT NOT NULL,
  credits INT NOT NULL DEFAULT 3,
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- FACULTY ASSIGNMENTS
CREATE TABLE faculty_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  subject_id INT NOT NULL,
  department_id INT NOT NULL,
  year INT NOT NULL,
  section VARCHAR(10) NOT NULL,
  academic_year_id INT NOT NULL,
  is_class_teacher BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (faculty_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

-- TIMETABLE
CREATE TABLE timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50),
  FOREIGN KEY (assignment_id) REFERENCES faculty_assignments(id)
) ENGINE=InnoDB;

-- ATTENDANCE
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  assignment_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present','absent','late','leave') NOT NULL DEFAULT 'absent',
  marked_by INT NOT NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP NULL,
  UNIQUE KEY unique_attendance (student_id, assignment_id, date),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (assignment_id) REFERENCES faculty_assignments(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- MARKS
CREATE TABLE marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  semester INT NOT NULL,
  exam_type ENUM('internal','external','assignment') NOT NULL,
  exam_label VARCHAR(100),
  marks_obtained DECIMAL(5,2),
  max_marks DECIMAL(5,2) NOT NULL,
  entered_by INT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (entered_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- STUDENT PROJECTS & COURSES
CREATE TABLE student_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('project','course','certification') NOT NULL,
  platform VARCHAR(150),
  completed_date DATE,
  verified_by INT,
  is_verified BOOLEAN DEFAULT FALSE,
  attachment_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- GRADES
CREATE TABLE grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  semester INT NOT NULL,
  grade_letter VARCHAR(5),
  grade_points DECIMAL(3,1),
  sgpa DECIMAL(4,2),
  cgpa DECIMAL(4,2),
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

-- STUDENT LEAVES
CREATE TABLE student_leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  faculty_id INT NOT NULL,
  leave_type ENUM('medical','personal','event') NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (faculty_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- FACULTY LEAVES
CREATE TABLE faculty_leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  hod_id INT NOT NULL,
  leave_type ENUM('medical','personal','duty') NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (faculty_id) REFERENCES users(id),
  FOREIGN KEY (hod_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- NOTICES
CREATE TABLE notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_by INT NOT NULL,
  target_role ENUM('all','faculty','student','hod') NOT NULL,
  target_department_id INT,
  target_year INT,
  target_section VARCHAR(10),
  priority ENUM('general','important','urgent') DEFAULT 'general',
  attachment_url VARCHAR(500),
  category ENUM('academic','administrative','event','urgent') DEFAULT 'academic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (target_department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- NOTICE READ RECEIPTS
CREATE TABLE notice_reads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notice_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_read (notice_id, user_id),
  FOREIGN KEY (notice_id) REFERENCES notices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- CALENDAR EVENTS
CREATE TABLE calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type ENUM('exam','assignment_deadline','holiday','event','other') NOT NULL,
  event_date DATE NOT NULL,
  end_date DATE,
  created_by INT NOT NULL,
  department_id INT,
  year INT,
  section VARCHAR(10),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- POLLS
CREATE TABLE polls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  open_date DATE NOT NULL,
  close_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE poll_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poll_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('multiple_choice','rating','open_text') NOT NULL,
  options JSON,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE poll_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poll_id INT NOT NULL,
  question_id INT NOT NULL,
  respondent_id INT,
  response_text TEXT,
  selected_option VARCHAR(255),
  rating_value INT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (question_id) REFERENCES poll_questions(id)
) ENGINE=InnoDB;

-- COMPLAINT WINDOWS
CREATE TABLE complaint_windows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  open_date DATE NOT NULL,
  close_date DATE NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- COMPLAINTS
CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_ref VARCHAR(20) NOT NULL UNIQUE,
  student_id INT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  window_id INT NOT NULL,
  message TEXT NOT NULL,
  attachment_url VARCHAR(500),
  status ENUM('submitted','under_review','resolved','dismissed') DEFAULT 'submitted',
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (window_id) REFERENCES complaint_windows(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- NOTIFICATIONS
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('notice','leave','marks','complaint','alert','poll','calendar') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  reference_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ALERT CONFIGURATION
CREATE TABLE alert_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT,
  attendance_threshold INT DEFAULT 75,
  alert_channels JSON,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- AUDIT LOG
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255) NOT NULL,
  table_affected VARCHAR(100),
  record_id INT,
  details JSON,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- PLACEMENT JOBS
CREATE TABLE IF NOT EXISTS placement_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company VARCHAR(150) NOT NULL,
  role VARCHAR(150) NOT NULL,
  description TEXT,
  min_cgpa DECIMAL(3,1) DEFAULT 6.0,
  eligible_years JSON COMMENT 'Array of year ints e.g. [3,4]',
  eligible_departments JSON COMMENT 'Array of dept codes e.g. ["CSE","ECE"]',
  openings INT DEFAULT 1,
  open_date DATE,
  close_date DATE,
  apply_link VARCHAR(500),
  contact_email VARCHAR(150),
  status ENUM('Active','Closed','Upcoming') DEFAULT 'Active',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- NEW TABLES (Phase 1 Architecture Additions)
-- ═══════════════════════════════════════════════════════════════

-- ACADEMIC CALENDAR (Working Day Registry per Department)
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
  FOREIGN KEY (department_id)    REFERENCES departments(id)     ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)  ON DELETE CASCADE,
  FOREIGN KEY (created_by)       REFERENCES users(id)
) ENGINE=InnoDB;

-- ATTENDANCE SESSIONS (Per-Class Period Tracker)
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

-- ALTER ATTENDANCE: link each record to a session
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS session_id INT NULL AFTER assignment_id,
  ADD CONSTRAINT fk_att_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE SET NULL;

-- ATTENDANCE SUMMARY (Cached Aggregates for fast reads)
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
  FOREIGN KEY (student_id)       REFERENCES users(id)              ON DELETE CASCADE,
  FOREIGN KEY (assignment_id)    REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- CROSS DEPT TEACHING VIEW
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
