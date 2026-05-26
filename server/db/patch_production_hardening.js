const db = require('./connection');

async function patch() {
    console.log('[Patch] Starting production security and integrity database migration...');

    // 1. Create login_attempts table
    await db.query(`
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            login_id VARCHAR(100) NOT NULL,
            ip_address VARCHAR(50) NOT NULL,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_failed BOOLEAN NOT NULL DEFAULT TRUE,
            INDEX idx_login_id (login_id),
            INDEX idx_attempted_at (attempted_at)
        ) ENGINE=InnoDB;
    `);
    console.log('[Patch] Checked/created login_attempts table.');

    // 2. Add Unique Key to faculty_assignments to prevent duplicate assignments
    try {
        await db.query(`
            ALTER TABLE faculty_assignments
            ADD CONSTRAINT unique_assignment UNIQUE (faculty_id, subject_id, department_id, year, section, academic_year_id)
        `);
        console.log('[Patch] Added UNIQUE constraint to faculty_assignments.');
    } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME') {
            console.log('[Patch] UNIQUE constraint unique_assignment already exists.');
        } else {
            console.warn('[Patch] Warning adding UNIQUE constraint (may contain duplicate records):', err.message);
        }
    }

    // 3. Ensure audit_logs is correctly structured
    await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            action VARCHAR(255) NOT NULL,
            table_affected VARCHAR(100),
            record_id INT,
            details JSON,
            performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    `);
    console.log('[Patch] Checked/created audit_logs table.');

    console.log('[Patch] Database migration patch successful!');
    process.exit(0);
}

patch().catch(err => {
    console.error('[Patch] Migration failed:', err);
    process.exit(1);
});
