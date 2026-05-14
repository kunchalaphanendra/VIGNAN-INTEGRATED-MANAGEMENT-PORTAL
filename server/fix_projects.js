const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function addColumnIfMissing(table, column, definition) {
    const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    if (rows.length === 0) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  + ${column}: added`);
    } else {
        console.log(`  - ${column}: already exists`);
    }
}

async function fix() {
    try {
        console.log('Checking student_projects columns...');
        await addColumnIfMissing('student_projects', 'project_link', 'VARCHAR(500) NULL');
        await addColumnIfMissing('student_projects', 'status', "ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending'");
        await addColumnIfMissing('student_projects', 'rejection_reason', 'TEXT NULL');

        const [final] = await db.query('DESCRIBE student_projects');
        console.log('\nAll columns now:', final.map(c => c.Field).join(', '));
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.sqlMessage || e.message);
        process.exit(1);
    }
}

fix();
