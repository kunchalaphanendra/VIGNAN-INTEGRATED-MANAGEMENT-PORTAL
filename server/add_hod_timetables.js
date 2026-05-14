/**
 * Migration: create hod_timetables table
 * Run once:  node server/add_hod_timetables.js
 */
const db = require('./db/connection');

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS hod_timetables (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                department_id INT NOT NULL,
                year          TINYINT NOT NULL,
                section       VARCHAR(10) NOT NULL,
                slots_json    JSON NOT NULL,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_hod_tt (department_id, year, section),
                FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log('✅  hod_timetables table created (or already exists).');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
