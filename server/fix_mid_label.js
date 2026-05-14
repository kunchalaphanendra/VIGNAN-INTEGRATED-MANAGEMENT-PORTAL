require('dotenv').config();
const db = require('./db/connection');
async function fix() {
    // Find all "MID" records
    const [midRows] = await db.query(`
        SELECT m.id, m.student_id, m.subject_id, m.academic_year_id, m.exam_type, 
               m.exam_label, m.marks_obtained, m.max_marks, u.full_name, s.name as sub
        FROM marks m JOIN users u ON m.student_id=u.id JOIN subjects s ON m.subject_id=s.id
        WHERE m.exam_label = 'MID'
        ORDER BY u.full_name
    `);
    console.log(`=== Found ${midRows.length} records with label "MID" ===`);
    midRows.forEach(r => console.log(`  [${r.id}] ${r.full_name} | ${r.sub} | ${r.marks_obtained}`));

    // For each "MID" record, check if a "MID1" record already exists for same student+subject+year+type
    for (const row of midRows) {
        const [existing] = await db.query(
            `SELECT id, marks_obtained FROM marks WHERE student_id=? AND subject_id=? AND academic_year_id=? AND exam_type=? AND exam_label='MID1'`,
            [row.student_id, row.subject_id, row.academic_year_id, row.exam_type]
        );
        if (existing.length > 0) {
            // Conflict: already has MID1. Delete the "MID" record (keep MID1)
            await db.query('DELETE FROM marks WHERE id=?', [row.id]);
            console.log(`  ⚠ Conflict: ${row.full_name} already has MID1 (${existing[0].marks_obtained}). Deleted "MID" record (was ${row.marks_obtained})`);
        } else {
            // No conflict: rename "MID" -> "MID1"
            await db.query('UPDATE marks SET exam_label=? WHERE id=?', ['MID1', row.id]);
            console.log(`  ✓ Renamed: ${row.full_name} | ${row.sub} | "MID" -> "MID1" (${row.marks_obtained})`);
        }
    }

    // Verify
    const [after] = await db.query(`SELECT exam_label, COUNT(*) as cnt FROM marks GROUP BY exam_label ORDER BY exam_label`);
    console.log('\n=== AFTER FIX ===');
    after.forEach(c => console.log(`  ${JSON.stringify(c.exam_label)} => ${c.cnt} records`));
    
    // Show what Phanendra (student_id=6) has now
    const [ph] = await db.query(`
        SELECT s.name as sub, m.exam_label, m.marks_obtained, m.is_published 
        FROM marks m JOIN subjects s ON m.subject_id=s.id WHERE m.student_id=6
        ORDER BY s.name, m.exam_label
    `);
    console.log('\n=== Phanendra (id=6) marks now ===');
    ph.forEach(r => console.log(`  ${r.sub} | ${r.exam_label} | ${r.marks_obtained} | pub=${r.is_published}`));
    
    process.exit(0);
}
fix().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
