require('dotenv').config();
const db = require('./db/connection');

async function run() {
    // Get all marks grouped by subject + exam_label
    const [rows] = await db.query(`
        SELECT s.name as subject, s.id as subject_id, m.exam_label, 
               COUNT(*) as count, GROUP_CONCAT(sp.roll_number ORDER BY sp.roll_number) as students
        FROM marks m 
        JOIN subjects s ON m.subject_id = s.id
        JOIN student_profiles sp ON sp.user_id = m.student_id
        GROUP BY s.id, m.exam_label
        ORDER BY s.name, m.exam_label
    `);
    
    process.stdout.write('=== MARKS SUMMARY ===\n');
    rows.forEach(r => process.stdout.write(r.subject + ' | ' + r.exam_label + ' | ' + r.count + ' students: ' + r.students + '\n'));
    
    process.exit(0);
}
run().catch(e => { process.stderr.write('ERROR: ' + e.message + '\n'); process.exit(1); });
