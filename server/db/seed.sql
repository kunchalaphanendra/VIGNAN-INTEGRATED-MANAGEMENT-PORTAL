USE vignan_portal;

-- Seed departments
INSERT INTO departments (name, code) VALUES 
('Computer Science & Engineering', 'CSE'),
('Electronics & Communication', 'ECE'),
('Mechanical Engineering', 'MECH'),
('Master of Business Administration', 'MBA');

-- Seed academic year
INSERT INTO academic_years (label, is_current) VALUES ('2024-2025', TRUE);

-- Seed principal account (password: Admin@1234)
-- bcrypt hash for Admin@1234 with 12 rounds
INSERT INTO users (login_id, password_hash, role, full_name, email, phone)
VALUES ('PRINCIPAL01', '$2b$12$08GYXtEF8ggjJglc1Mu0.3c.voK3JfbkKGvUXOvLT5sOXOo.', 'principal', 
        'DURGA SUKUMAR', 'principal@vignan.edu.in', '9000000001');

-- Alert config default
INSERT INTO alert_config (attendance_threshold, alert_channels)
VALUES (75, '{"email":true,"sms":true,"whatsapp":true}');

-- Seed some subjects for CSE department (id=1)
INSERT INTO subjects (name, code, department_id, semester, credits) VALUES
('Data Structures', 'CS201', 1, 3, 4),
('Database Management Systems', 'CS301', 1, 5, 4),
('Operating Systems', 'CS302', 1, 5, 4),
('Computer Networks', 'CS401', 1, 7, 3),
('Object Oriented Programming', 'CS202', 1, 3, 3),
('Web Technologies', 'CS303', 1, 5, 3);

-- Seed subjects for ECE department (id=2)
INSERT INTO subjects (name, code, department_id, semester, credits) VALUES
('Digital Electronics', 'EC201', 2, 3, 4),
('Signals & Systems', 'EC301', 2, 5, 4),
('VLSI Design', 'EC401', 2, 7, 3);
