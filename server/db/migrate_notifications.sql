-- Recreate notifications table with new structure
DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'warning', 'success', 'danger', 'academic', 'placement', 'complaint', 'attendance', 'marks', 'leave', 'system', 'notice', 'poll', 'calendar') NOT NULL,
  sender_role VARCHAR(50) NULL,
  sender_id INT NULL,
  recipient_role VARCHAR(50) NULL,
  department_id INT NULL,
  target_url VARCHAR(500) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;
