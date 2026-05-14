const db = require('./server/db/connection');

const sql = `
CREATE TABLE IF NOT EXISTS placement_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company VARCHAR(150) NOT NULL,
  role VARCHAR(150) NOT NULL,
  description TEXT,
  min_cgpa DECIMAL(3,1) DEFAULT 6.0,
  eligible_years JSON,
  eligible_departments JSON,
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
) ENGINE=InnoDB
`;

db.query(sql)
  .then(() => { console.log('✅ placement_jobs table created (or already exists)'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
