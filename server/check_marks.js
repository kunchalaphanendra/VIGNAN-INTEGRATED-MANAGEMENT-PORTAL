require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db/connection');

async function check() {
    // List all marks
    const [rows] = await db.query(`
        SELECT m.id, m.student_id, u.full_name, s.name as subject, 
               m.exam_type, m.exam_label, m.marks_obtained, m.max_marks, 
               m.academic_year_id, m.is_published, m.entered_by
        FROM marks m 
        JOIN users u ON m.student_id = u.id 
        JOIN subjects s ON m.subject_id = s.id 
        ORDER BY s.name, m.exam_label, u.full_name
    `);
    
    console.log('\n=== ALL MARKS IN DATABASE ===');
    console.log(`Total records: ${rows.length}\n`);
    
    rows.forEach(r => {
        console.log(`[${r.id}] ${r.full_name} | ${r.subject} | ${r.exam_label} | ${r.marks_obtained}/${r.max_marks} | published=${r.is_published} | academic_year_id=${r.academic_year_id}`);
    });
    
    // Check specifically for the student Phanendra (24891A67A0)
    const [sp] = await db.query(`SELECT u.id, u.full_name FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE sp.roll_number = '24891A67A0'`);
    if (sp.length > 0) {
        console.log(`\n=== PHANENDRA's MARKS (id=${sp[0].id}) ===`);
        const [pm] = await db.query(`
            SELECT m.*, s.name as subject FROM marks m 
            JOIN subjects s ON m.subject_id = s.id 
            WHERE m.student_id = ?
        `, [sp[0].id]);
        pm.forEach(r => {
            console.log(`  ${r.subject} | ${r.exam_label} | ${r.marks_obtained}/${r.max_marks} | published=${r.is_published}`);
        });
        console.log(`  Total: ${pm.length} records`);
    }
    
    process.exit(0);
}

check().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
