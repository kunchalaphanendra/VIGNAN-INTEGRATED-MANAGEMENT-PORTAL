require('dotenv').config();
const db = require('./db/connection');
async function run() {
    // All DBMS marks
    const [rows] = await db.query(`
        SELECT m.id, m.student_id, u.full_name, s.name as sub, 
               m.exam_label, m.marks_obtained, m.is_published, m.academic_year_id
        FROM marks m 
        JOIN users u ON m.student_id = u.id 
        JOIN subjects s ON m.subject_id = s.id 
        WHERE s.name LIKE '%base%' 
        ORDER BY m.exam_label, u.full_name
    `);
    console.log('=== DBMS MARKS ===');
    rows.forEach(x => console.log(`id=${x.id} label=${JSON.stringify(x.exam_label)} student=${x.full_name} marks=${x.marks_obtained} pub=${x.is_published}`));
    
    // Count by exam_label
    const [counts] = await db.query(`SELECT exam_label, COUNT(*) as cnt FROM marks GROUP BY exam_label ORDER BY exam_label`);
    console.log('\n=== ALL EXAM LABELS ===');
    counts.forEach(c => console.log(`${JSON.stringify(c.exam_label)} => ${c.cnt} records`));
    
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
