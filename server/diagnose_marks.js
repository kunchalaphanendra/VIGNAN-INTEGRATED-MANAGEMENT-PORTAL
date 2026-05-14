require('dotenv').config();
const db = require('./db/connection');

// These are the MID1 DBMS marks from the faculty screenshot:
// Roll No         Name                          Marks  
// 2489166770      UDAY                         58/100
// 24891A6783      Vikranth                     95/100  
// 24891A67A0      Phanendra                    89/100  (MISSING - was deleted as conflict)
// 24891A67A8      AKSHAY                       85/100
// 24891A67A8 ->wait, screenshot shows 24891A6785 = sai charan, 24891A67B5 = PUTTA venkata...
// Let me just check all missing students and insert their records

async function fixMissingMid1() {
    // Get the DBMS subject id
    const [subj] = await db.query("SELECT id, name FROM subjects WHERE name LIKE '%base%' OR name LIKE '%data%' ORDER BY id LIMIT 1");
    if (!subj.length) { console.log('Subject not found'); return process.exit(1); }
    const subjectId = subj[0].id;
    console.log('Subject:', subj[0].name, 'id=', subjectId);
    
    // Get faculty who entered DBMS marks (entered_by)
    const [enteredBy] = await db.query('SELECT DISTINCT entered_by FROM marks WHERE subject_id=?', [subjectId]);
    const facultyId = enteredBy.length ? enteredBy[0].entered_by : 7;
    console.log('Faculty id (entered_by):', facultyId);
    
    // Get current DBMS MID1 records
    const [existing] = await db.query(
        "SELECT student_id, marks_obtained FROM marks WHERE subject_id=? AND exam_label='MID1'",
        [subjectId]
    );
    const existingIds = new Set(existing.map(r => r.student_id));
    console.log('Already have MID1 for student_ids:', [...existingIds]);
    
    // Get all students who should be in this class (check from MID2 records for the same subject)
    const [mid2students] = await db.query(
        "SELECT m.student_id, u.full_name, sp.roll_number FROM marks m JOIN users u ON m.student_id=u.id JOIN student_profiles sp ON sp.user_id=u.id WHERE m.subject_id=? AND m.exam_label='MID2'",
        [subjectId]
    );
    console.log('\nStudents with MID2 (these are the same class):');
    mid2students.forEach(s => process.stdout.write('  ' + s.roll_number + ' ' + s.full_name + ' (id=' + s.student_id + ')\n'));
    
    // The faculty screenshot shows these marks for MID1 DBMS:
    // We know from the original entry the exam_type was 'internal', academic_year_id=1
    // We need to find what marks Phanendra (id=6) should have had.
    // From the faculty portal screenshot: Phanendra had 89/100 for MID1
    
    // Get academic_year_id from existing marks
    const [ayRow] = await db.query('SELECT academic_year_id FROM marks WHERE subject_id=? LIMIT 1', [subjectId]);
    const ayId = ayRow.length ? ayRow[0].academic_year_id : 1;
    
    // Find which students from MID2 are missing MID1
    const missing = mid2students.filter(s => !existingIds.has(s.student_id));
    console.log('\nStudents missing MID1:', missing.map(s => s.roll_number + ' ' + s.full_name));
    
    if (missing.length === 0) {
        console.log('No missing students!');
        return process.exit(0);
    }
    
    console.log('\n⚠ These students are MISSING MID1 data for DBMS.');
    console.log('The original MID1 data was accidentally deleted when the faculty re-labeled marks.');
    console.log('You need the faculty to re-enter these marks OR we can restore from backup.');
    console.log('\nTo re-enter marks, the faculty should:');
    console.log('1. Go to Faculty Portal → Marks → Enter Marks');
    console.log('2. Select the DBMS subject');
    console.log('3. Set Exam Type = Internal, Exam Label = MID1');
    console.log('4. Enter the correct marks for these students');
    
    process.exit(0);
}

fixMissingMid1().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
