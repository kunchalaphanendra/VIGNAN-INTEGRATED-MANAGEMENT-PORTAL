require('dotenv').config();
const db = require('./db/connection');
async function run() {
    // Check exact records for student 24891A67A0 (Phanendra)
    const [sp] = await db.query("SELECT u.id, u.full_name FROM users u JOIN student_profiles sp ON sp.user_id=u.id WHERE sp.roll_number='24891A67A0'");
    if (!sp.length) { process.stdout.write('Student not found\n'); return process.exit(1); }
    const sid = sp[0].id;
    process.stdout.write('Student: ' + sp[0].full_name + ' id=' + sid + '\n');
    
    const [marks] = await db.query("SELECT m.id, s.name as sub, m.exam_label, m.marks_obtained, m.is_published FROM marks m JOIN subjects s ON m.subject_id=s.id WHERE m.student_id=?", [sid]);
    process.stdout.write('Marks for student ' + sid + ':\n');
    marks.forEach(m => process.stdout.write('  [' + m.id + '] ' + m.sub + ' | ' + m.exam_label + ' | ' + m.marks_obtained + ' | is_published=' + m.is_published + '\n'));
    
    // Check if there's a subject_id mismatch
    const [subjs] = await db.query("SELECT id, name FROM subjects WHERE name LIKE '%base%'");
    process.stdout.write('\nDBMS subjects: ' + JSON.stringify(subjs) + '\n');
    
    process.exit(0);
}
run().catch(e => { process.stderr.write('ERROR: ' + e.message + '\n'); process.exit(1); });
