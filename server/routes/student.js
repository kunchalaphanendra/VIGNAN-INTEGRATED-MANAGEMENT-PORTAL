const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const upload = require('../middleware/upload');

router.use(auth, roleGuard('student'));

// GET /api/student/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // â”€â”€ Overall & Subject-wise attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Both use the attendance table as the SINGLE source of truth â€” same logic
        // as GET /student/attendance so dashboard and attendance page always match.
        // COUNT(*)  = total classes conducted (denominator)
        // SUM(present/late) = attended (numerator)
        // HOD-unconfirmed out-of-window sessions excluded via NOT EXISTS (period-level).

        const [attRows] = await db.query(`
            SELECT
                s.name  AS subject_name,
                s.code  AS code,
                COUNT(*) AS total,
                SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            JOIN subjects s             ON s.id  = fa.subject_id
            WHERE a.student_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM attendance_sessions ats
                WHERE ats.assignment_id  = a.assignment_id
                  AND DATE(ats.session_date) = DATE(a.date)
                  AND (a.period_number IS NULL OR ats.period_number = a.period_number)
                  AND ats.outside_window = 1
                  AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
              )
            GROUP BY fa.subject_id, s.name, s.code
            ORDER BY s.name
        `, [req.user.id]);

        // Build subject list and compute overall from same rows
        const subjectAtt = attRows.map(r => ({
            subject_name: r.subject_name,
            code: r.code,
            total: Number(r.total) || 0,
            attended: Number(r.attended) || 0,
            percentage: Number(r.total) > 0
                ? Math.round(Number(r.attended) * 10000.0 / Number(r.total)) / 100
                : 0,
        }));

        const overallTotal = subjectAtt.reduce((s, r) => s + r.total, 0);
        const overallAttended = subjectAtt.reduce((s, r) => s + r.attended, 0);
        const overallAtt = [{
            total: overallTotal,
            attended: overallAttended,
            percentage: overallTotal > 0
                ? Math.round(overallAttended * 10000.0 / overallTotal) / 100
                : 0,
        }];

        // Latest marks
        const [latestMarks] = await db.query(`
      SELECT s.name as subject_name, m.exam_type, m.exam_label, m.marks_obtained, m.max_marks
      FROM marks m JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ? AND m.is_published = TRUE
      ORDER BY m.created_at DESC LIMIT 5
    `, [req.user.id]);

        // Recent notices
        const [notices] = await db.query(`
      SELECT n.* FROM notices n
      JOIN student_profiles sp ON sp.user_id = ?
      WHERE n.target_role IN ('all','student')
        AND (n.target_department_id = sp.department_id OR n.target_department_id IS NULL)
        AND (n.target_year = sp.year OR n.target_year IS NULL)
        AND (n.target_section = sp.section OR n.target_section IS NULL)
      ORDER BY n.created_at DESC LIMIT 3
    `, [req.user.id]);

        // Leave status
        const [leaves] = await db.query(
            'SELECT * FROM student_leaves WHERE student_id=? ORDER BY created_at DESC LIMIT 3', [req.user.id]
        );

        // Upcoming events
        const [events] = await db.query(`
      SELECT * FROM calendar_events 
      WHERE event_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND (department_id = (SELECT department_id FROM student_profiles WHERE user_id=?) OR department_id IS NULL)
      ORDER BY event_date LIMIT 5
    `, [req.user.id]);


        // GPA - from dedicated student_cgpa table
        let gpaRow = { current_sgpa: null, cgpa: null };
        try {
            const [gpaRows] = await db.query(
                `SELECT cgpa, sgpa as current_sgpa FROM student_cgpa WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1`,
                [req.user.id]
            );
            if (gpaRows.length > 0) gpaRow = gpaRows[0];
        } catch { /* student_cgpa may not exist yet */ }

        // Complaint window
        const [window] = await db.query(
            'SELECT * FROM complaint_windows WHERE close_date >= CURDATE() ORDER BY open_date LIMIT 1'
        );

        // Active backlogs count
        let activeBacklogs = { total_backlogs: 0, backlog_entries: 0 };
        try {
            const [blRows] = await db.query(
                `SELECT COUNT(*) as backlog_entries, COALESCE(SUM(backlog_count),0) as total_backlogs FROM student_backlogs WHERE student_id = ? AND status = 'active'`,
                [req.user.id]
            );
            if (blRows.length > 0) activeBacklogs = blRows[0];
        } catch { /* table may not exist */ }

        // --- Attendance Projection Calculation ---
        // 1. Working Days via Academic Calendar (Data Source: calendar)
        // Ensure we retrieve for the student's department_id
        const [calRows] = await db.query(
            `SELECT COUNT(*) as working_days, MAX(calendar_date) as last_date 
             FROM academic_calendar 
             WHERE day_type IN ('working', 'compensatory') 
             AND department_id = (SELECT department_id FROM student_profiles WHERE user_id=?)`,
            [req.user.id]
        );
        const workingDays = calRows[0]?.working_days || 0;
        const lastCalendarDate = calRows[0]?.last_date ? new Date(calRows[0].last_date) : null;
        const now = new Date();
        const isOngoing = lastCalendarDate ? lastCalendarDate >= now : true;

        // Total classes calculation
        // 3. Formula: Working Days x Classes Per Day (Fixed: 7)
        let totalVal = workingDays * 7; 
        
        // 8. Edge Case: If semester is ongoing, use current conducted classes instead of full total
        const totConducted = overallAtt[0].total;
        if (isOngoing || totalVal === 0) {
            totalVal = totConducted;
        }

        const totAttended = overallAtt[0].attended;
        const requiredClasses = Math.ceil(0.75 * totalVal);
        const maxAbsences = totalVal - requiredClasses;
        const missedClasses = totConducted - totAttended;
        const remainingClasses = maxAbsences - missedClasses;

        const attendanceProjection = {
            total_classes: totalVal,
            required_classes: requiredClasses,
            max_absences: maxAbsences,
            missed_classes: missedClasses,
            remaining_classes: remainingClasses,
            current_percentage: overallAtt[0].percentage,
            is_ongoing: isOngoing
        };

        res.json({
            overall_attendance: overallAtt[0],
            subject_attendance: subjectAtt,
            latest_marks: latestMarks,
            notices,
            leaves,
            upcoming_events: events,
            gpa: gpaRow,
            complaint_window: window.length > 0 ? window[0] : null,
            active_backlogs: activeBacklogs,
            attendance_projection: attendanceProjection
        });
    } catch (err) {
        console.error('Student dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/attendance
router.get('/attendance', async (req, res) => {
    try {
        // Single query: attendance table is the single source of truth.
        // total  = COUNT(*)           â†’ how many classes were marked (denominator)
        // attended = SUM(present+late) â†’ how many the student attended (numerator)
        // When a new absent row is inserted, total goes from N to N+1 automatically.
        // HOD-unconfirmed out-of-window sessions are excluded via NOT EXISTS.
        const [rows] = await db.query(`
            SELECT
                s.name  AS subject_name,
                s.code  AS code,
                COUNT(*) AS total,
                SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)           AS present_count,
                SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END)           AS absent_count,
                SUM(CASE WHEN a.status = 'late'    THEN 1 ELSE 0 END)           AS late_count,
                SUM(CASE WHEN a.status = 'leave'   THEN 1 ELSE 0 END)           AS leave_count
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            JOIN subjects s             ON s.id  = fa.subject_id
            WHERE a.student_id = ?
              AND NOT EXISTS (
                -- Exclude rows belonging to an unconfirmed out-of-window session
                -- Match by period_number when available, else by date only
                SELECT 1 FROM attendance_sessions ats
                WHERE ats.assignment_id  = a.assignment_id
                  AND DATE(ats.session_date) = DATE(a.date)
                  AND (a.period_number IS NULL OR ats.period_number = a.period_number)
                  AND ats.outside_window = 1
                  AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
              )
            GROUP BY fa.subject_id, s.name, s.code
            ORDER BY s.name
        `, [req.user.id]);

        // Cast MySQL SUM/COUNT results (can be BigInt or string) to plain JS numbers
        const subjects = rows.map(r => {
            const total = Number(r.total) || 0;
            const attended = Number(r.attended) || 0;
            return {
                subject_name: r.subject_name,
                code: r.code,
                total,
                attended,
                present_count: Number(r.present_count) || 0,
                absent_count: Number(r.absent_count) || 0,
                late_count: Number(r.late_count) || 0,
                leave_count: Number(r.leave_count) || 0,
                percentage: total > 0 ? Math.round(attended * 10000.0 / total) / 100 : 0,
                fraction: `${attended}/${total}`,
            };
        });

        // Overall totals across all subjects
        const overallTotal = subjects.reduce((s, r) => s + r.total, 0);
        const overallAttended = subjects.reduce((s, r) => s + r.attended, 0);
        const overall = {
            total: overallTotal,
            attended: overallAttended,
            percentage: overallTotal > 0 ? Math.round(overallAttended * 10000.0 / overallTotal) / 100 : 0,
            fraction: `${overallAttended}/${overallTotal}`,
        };


        // â”€â”€ 6. Calendar data (unchanged â€” for the history grid) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const [calendar] = await db.query(`
            SELECT a.date, a.status, s.name as subject_name
            FROM attendance a
            JOIN faculty_assignments fa ON a.assignment_id = fa.id
            JOIN subjects s ON fa.subject_id = s.id
            WHERE a.student_id = ?
            ORDER BY a.date DESC
        `, [req.user.id]);

        res.json({ subjects, overall, calendar });
    } catch (err) {
        console.error('Student attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/attendance/day-wise â€” period-by-period history grouped by date
router.get('/attendance/day-wise', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                DATE_FORMAT(a.date, '%Y-%m-%d')          AS date,
                DAYNAME(a.date)                           AS day_name,
                COALESCE(a.period_number, ats.period_number) AS period_number,
                TIME_FORMAT(ats.start_time, '%h:%i %p')  AS start_time,
                TIME_FORMAT(ats.end_time,   '%h:%i %p')  AS end_time,
                s.name  AS subject_name,
                s.code  AS subject_code,
                a.status,
                u.full_name AS faculty_name
            FROM attendance a
            JOIN faculty_assignments fa  ON fa.id  = a.assignment_id
            JOIN subjects            s   ON s.id   = fa.subject_id
            JOIN users               u   ON u.id   = fa.faculty_id
            LEFT JOIN attendance_sessions ats
                   ON ats.assignment_id = a.assignment_id
                  AND DATE(ats.session_date) = DATE(a.date)
                  AND (a.period_number IS NULL OR ats.period_number = a.period_number)
            WHERE a.student_id = ?
            ORDER BY a.date DESC, COALESCE(a.period_number, ats.period_number) ASC
        `, [req.user.id]);

        // Group by date
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.date]) {
                grouped[r.date] = { date: r.date, day_name: r.day_name, records: [] };
            }
            grouped[r.date].records.push({
                period_number: r.period_number,
                start_time: r.start_time,
                end_time: r.end_time,
                subject_name: r.subject_name,
                subject_code: r.subject_code,
                status: r.status,
                faculty_name: r.faculty_name,
            });
        });

        // Return as sorted array (most recent first)
        const history = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});



// GET /api/student/attendance/projection
router.get('/attendance/projection', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT fa.subject_id, s.name as subject_name,
        COUNT(*) as total,
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) as current_pct
      FROM attendance a
      JOIN faculty_assignments fa ON a.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE a.student_id = ?
      GROUP BY fa.subject_id
    `, [req.user.id]);

        // Calculate how many more can be missed while staying above 75%
        const projections = rows.map(r => {
            // attended / (total + x) >= 0.75 => x <= attended/0.75 - total
            const canMiss = Math.max(0, Math.floor(r.attended / 0.75 - r.total));
            return { ...r, classes_can_miss: canMiss };
        });

        res.json({ projections });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/marks
router.get('/marks', async (req, res) => {
    try {
        // Auto-create marks table if it doesn't exist yet
        await db.query(`
            CREATE TABLE IF NOT EXISTS marks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                subject_id INT NOT NULL,
                academic_year_id INT NOT NULL DEFAULT 1,
                semester TINYINT NOT NULL DEFAULT 1,
                exam_type ENUM('internal','external','assignment') NOT NULL DEFAULT 'internal',
                exam_label VARCHAR(100) NOT NULL,
                marks_obtained DECIMAL(6,2) NOT NULL,
                max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
                entered_by INT NOT NULL,
                is_published TINYINT(1) NOT NULL DEFAULT 1,
                locked TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_mark (student_id, subject_id, academic_year_id, exam_type, exam_label)
            )
        `).catch(() => {});

        const [rows] = await db.query(`
      SELECT m.*, s.name as subject_name, s.code, s.credits
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ? AND m.is_published = 1
      ORDER BY s.name, m.exam_type, m.exam_label
    `, [req.user.id]);
        res.json({ marks: rows });
    } catch (err) {
        console.error('Student marks error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/student/grades
router.get('/grades', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT g.*, s.name as subject_name, s.code, s.credits
            FROM grades g
            JOIN subjects s ON g.subject_id = s.id
            WHERE g.student_id = ?
            ORDER BY g.semester, s.name
        `, [req.user.id]);

        let manual_gpa = null;
        try {
            const [gpaRows] = await db.query(
                `SELECT cgpa, sgpa, semester, updated_at FROM student_cgpa WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1`,
                [req.user.id]
            );
            if (gpaRows.length > 0) manual_gpa = gpaRows[0];
        } catch { /* table may not exist yet */ }

        res.json({ grades: rows, manual_gpa });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/gpa/history
router.get('/gpa/history', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT semester, ROUND(AVG(grade_points), 2) as avg_grade_points,
                (SELECT ROUND(SUM(g2.grade_points * s2.credits) / SUM(s2.credits), 2)
                 FROM grades g2 JOIN subjects s2 ON g2.subject_id = s2.id
                 WHERE g2.student_id = ? AND g2.semester = g.semester) as sgpa
            FROM grades g
            WHERE g.student_id = ?
            GROUP BY g.semester
            ORDER BY g.semester
        `, [req.user.id, req.user.id]);
        res.json({ history: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/performance
router.get('/performance', async (req, res) => {
    try {
        const [myMarks] = await db.query(`
      SELECT s.name as subject_name, m.exam_type, m.exam_label,
        m.marks_obtained, m.max_marks,
        ROUND(m.marks_obtained*100.0/m.max_marks, 2) as my_percentage
      FROM marks m JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ? AND m.is_published = TRUE
    `, [req.user.id]);

        // Class average (anonymized)
        const [classAvg] = await db.query(`
      SELECT s.name as subject_name, m.exam_type, m.exam_label,
        ROUND(AVG(m.marks_obtained*100.0/m.max_marks), 2) as class_avg_percentage
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      WHERE m.is_published = TRUE AND s.department_id = (SELECT department_id FROM student_profiles WHERE user_id=?)
      GROUP BY m.subject_id, m.exam_type, m.exam_label
    `, [req.user.id]);

        res.json({ my_marks: myMarks, class_average: classAvg });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/projects
router.get('/projects', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT sp.*, u.full_name, pr.roll_number
             FROM student_projects sp
             JOIN users u ON u.id = sp.student_id
             LEFT JOIN student_profiles pr ON pr.user_id = sp.student_id
             WHERE sp.student_id=? ORDER BY sp.created_at DESC`,
            [req.user.id]
        );
        res.json({ projects: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/student/projects
router.post('/projects', upload.single('attachment'), async (req, res) => {
    try {
        const { title, description, type, platform, completed_date, project_link } = req.body;
        const attachmentUrl = req.file ? `/uploads/${req.user.role}/${req.user.id}/${req.file.filename}` : null;

        // Ensure project_link column exists (safe migration)
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS project_link VARCHAR(500) NULL`).catch(() => {});
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending'`).catch(() => {});
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL`).catch(() => {});

        const [result] = await db.query(
            'INSERT INTO student_projects (student_id, title, description, type, platform, completed_date, attachment_url, project_link) VALUES (?,?,?,?,?,?,?,?)',
            [req.user.id, title, description, type, platform, completed_date || null, attachmentUrl, project_link || null]
        );
        res.status(201).json({ message: 'Project submitted', id: result.insertId });
    } catch (err) {
        console.error('Submit project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/student/timetable
// Reads from hod_timetables (the JSON blob saved by the HOD Timetable Builder)
// and returns a flat list of period rows the student UI renders.
router.get('/timetable', async (req, res) => {
    try {
        // 1. Get the student's dept/year/section
        const [profileRows] = await db.query(
            'SELECT department_id, year, section FROM student_profiles WHERE user_id = ?',
            [req.user.id]
        );
        if (profileRows.length === 0) return res.json({ timetable: [], last_updated: null });
        const { department_id, year, section } = profileRows[0];

        // 2. Load the HOD's saved timetable blob for this section
        const [ttRows] = await db.query(
            'SELECT slots_json, updated_at FROM hod_timetables WHERE department_id = ? AND year = ? AND section = ?',
            [department_id, year, section]
        );
        if (ttRows.length === 0 || !ttRows[0].slots_json) {
            return res.json({ timetable: [], last_updated: null });
        }

        const slots = typeof ttRows[0].slots_json === 'string'
            ? JSON.parse(ttRows[0].slots_json)
            : ttRows[0].slots_json;
        const lastUpdated = ttRows[0].updated_at;

        // 3. Flatten { Monday: [...], Tuesday: [...], ... } into a flat row list
        //    matching the fields the student Timetable.jsx renders:
        //    day_of_week, start_time, end_time, subject_name, faculty_name, room_number, slot_type
        const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timetable = [];

        for (const day of DAYS) {
            const daySlots = slots[day];
            if (!Array.isArray(daySlots)) continue;
            daySlots.forEach((slot) => {
                if (!slot) return; // null = cleared slot
                timetable.push({
                    day_of_week: day,
                    start_time: slot.startTime || slot.start_time || '',
                    end_time: slot.endTime || slot.end_time || '',
                    subject_name: slot.subject || slot.subject_name || (slot.type === 'free' ? 'Free Period' : ''),
                    faculty_name: slot.facultyName || slot.faculty_name || '',
                    room_number: slot.room || slot.room_number || '',
                    slot_type: slot.type || 'class',
                    period: slot.period || null,
                });
            });
        }

        res.json({ timetable, last_updated: lastUpdated });
    } catch (err) {
        console.error('Student timetable error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

    // GET /api/student/notices
    router.get('/notices', async (req, res) => {
        try {
            const [rows] = await db.query(`
      SELECT n.*, 
        CASE WHEN nr.id IS NOT NULL THEN TRUE ELSE FALSE END as is_read
      FROM notices n
      LEFT JOIN notice_reads nr ON nr.notice_id = n.id AND nr.user_id = ?
      JOIN student_profiles sp ON sp.user_id = ?
      WHERE n.target_role IN ('all','student')
        AND (n.target_department_id = sp.department_id OR n.target_department_id IS NULL)
        AND (n.target_year = sp.year OR n.target_year IS NULL)
        AND (n.target_section = sp.section OR n.target_section IS NULL)
      ORDER BY n.created_at DESC
    `, [req.user.id, req.user.id]);

            // Auto-clear notice bell notifications when student opens the Notices page
            db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND type = 'notice' AND is_read = FALSE`, [req.user.id]).catch(() => {});

            res.json({ notices: rows });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // PATCH /api/student/notices/:id/read
    router.patch('/notices/:id/read', async (req, res) => {
        try {
            await db.query(
                'INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?,?)',
                [req.params.id, req.user.id]
            );
            res.json({ message: 'Marked as read' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/calendar
    router.get('/calendar', async (req, res) => {
        try {
            const [rows] = await db.query(`
      SELECT ce.* FROM calendar_events ce
      JOIN student_profiles sp ON sp.user_id = ?
      WHERE (ce.department_id = sp.department_id OR ce.department_id IS NULL)
        AND (ce.year = sp.year OR ce.year IS NULL)
      ORDER BY ce.event_date
    `, [req.user.id]);
            res.json({ events: rows });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/student/leaves
    router.post('/leaves', upload.single('attachment'), async (req, res) => {
        try {
            const { leave_type, from_date, to_date, reason } = req.body;
            if (!leave_type || !from_date || !to_date || !reason) {
                return res.status(400).json({ error: 'All fields required' });
            }

            // Find class teacher
            const [ct] = await db.query(`
      SELECT fa.faculty_id FROM faculty_assignments fa
      JOIN student_profiles sp ON sp.department_id = fa.department_id AND sp.year = fa.year AND sp.section = fa.section
      WHERE sp.user_id = ? AND fa.is_class_teacher = TRUE
      LIMIT 1
    `, [req.user.id]);
            if (ct.length === 0) return res.status(400).json({ error: 'No class teacher assigned' });

            const attachmentUrl = req.file ? `/uploads/${req.user.role}/${req.user.id}/${req.file.filename}` : null;

            const [result] = await db.query(
                'INSERT INTO student_leaves (student_id, faculty_id, leave_type, from_date, to_date, reason, attachment_url) VALUES (?,?,?,?,?,?,?)',
                [req.user.id, ct[0].faculty_id, leave_type, from_date, to_date, reason, attachmentUrl]
            );

            // Notify class teacher
            await db.query(
                'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?,?,?,?,?)',
                [ct[0].faculty_id, 'New Leave Request', `${req.user.full_name} has requested leave from ${from_date} to ${to_date}`, 'leave', result.insertId]
            );

            res.status(201).json({ message: 'Leave request submitted', id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/leaves
    router.get('/leaves', async (req, res) => {
        try {
            const [rows] = await db.query(`
      SELECT sl.*, u.full_name as faculty_name
      FROM student_leaves sl
      JOIN users u ON sl.faculty_id = u.id
      WHERE sl.student_id = ?
      ORDER BY sl.created_at DESC
    `, [req.user.id]);
            res.json({ leaves: rows });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/complaint/window
    // Returns TWO portal statuses: principal and hod (scoped to student's dept)
    router.get('/complaint/window', async (req, res) => {
        try {
            // Principal's open window (no department restriction)
            const [principalCurrent] = await db.query(
                `SELECT cw.*, u.full_name as opened_by_name, u.role as opened_by_role
                 FROM complaint_windows cw
                 JOIN users u ON u.id = cw.created_by
                 WHERE cw.created_by_role = 'principal'
                   AND cw.open_date <= CURDATE() AND cw.close_date >= CURDATE() LIMIT 1`
            );
            const [principalNext] = await db.query(
                `SELECT * FROM complaint_windows WHERE created_by_role = 'principal'
                 AND open_date > CURDATE() ORDER BY open_date LIMIT 1`
            );

            // HOD's open window (must match student's department)
            const [studentDept] = await db.query(
                'SELECT department_id FROM student_profiles WHERE user_id = ?',
                [req.user.id]
            );
            const deptId = studentDept[0]?.department_id;

            // Get HOD info for the department
            const [hodInfo] = await db.query(
                `SELECT u.full_name, d.name as dept_name
                 FROM users u
                 JOIN departments d ON d.id = u.department_id
                 WHERE u.role = 'hod' AND u.department_id = ? AND u.is_active = TRUE LIMIT 1`,
                [deptId]
            );

            const [hodCurrent] = await db.query(
                `SELECT cw.*, u.full_name as opened_by_name
                 FROM complaint_windows cw
                 JOIN users u ON u.id = cw.created_by
                 WHERE cw.created_by_role = 'hod'
                   AND cw.department_id = ?
                   AND cw.open_date <= CURDATE() AND cw.close_date >= CURDATE() LIMIT 1`,
                [deptId]
            );
            const [hodNext] = await db.query(
                `SELECT * FROM complaint_windows WHERE created_by_role = 'hod'
                 AND department_id = ? AND open_date > CURDATE() ORDER BY open_date LIMIT 1`,
                [deptId]
            );

            res.json({
                principal: {
                    is_open: principalCurrent.length > 0,
                    current_window: principalCurrent.length > 0 ? principalCurrent[0] : null,
                    next_window: principalNext.length > 0 ? principalNext[0] : null,
                    opened_by: 'Principal',
                },
                hod: {
                    is_open: hodCurrent.length > 0,
                    current_window: hodCurrent.length > 0 ? hodCurrent[0] : null,
                    next_window: hodNext.length > 0 ? hodNext[0] : null,
                    opened_by: hodInfo.length > 0 ? `HOD (${hodInfo[0].dept_name})` : 'HOD',
                    hod_name: hodInfo[0]?.full_name || null,
                    dept_name: hodInfo[0]?.dept_name || null,
                },
                // Legacy: is_open true if either portal is open
                is_open: principalCurrent.length > 0 || hodCurrent.length > 0,
                current_window: principalCurrent[0] || hodCurrent[0] || null,
                next_window: principalNext[0] || hodNext[0] || null,
            });
        } catch (err) {
            console.error('Student complaint window error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/student/complaint
    router.post('/complaint', upload.single('attachment'), async (req, res) => {
        try {
            const { title, message, is_anonymous, portal_type } = req.body;
            if (!message) return res.status(400).json({ error: 'Message is required' });

            const targetPortal = portal_type === 'hod' ? 'hod' : 'principal';

            // Get student's department for HOD portal validation
            const [studentDept] = await db.query(
                'SELECT department_id FROM student_profiles WHERE user_id = ?',
                [req.user.id]
            );
            const deptId = studentDept[0]?.department_id;

            let window;
            if (targetPortal === 'hod') {
                // Check HOD's window for this department
                const [hodWindow] = await db.query(
                    `SELECT * FROM complaint_windows
                     WHERE created_by_role = 'hod' AND department_id = ?
                       AND open_date <= CURDATE() AND close_date >= CURDATE() LIMIT 1`,
                    [deptId]
                );
                if (hodWindow.length === 0) return res.status(400).json({ error: 'HOD complaint window is not open' });
                window = hodWindow;
            } else {
                // Check Principal's window
                const [principalWindow] = await db.query(
                    `SELECT * FROM complaint_windows
                     WHERE created_by_role = 'principal'
                       AND open_date <= CURDATE() AND close_date >= CURDATE() LIMIT 1`
                );
                if (principalWindow.length === 0) return res.status(400).json({ error: 'Complaint window is not open' });
                window = principalWindow;
            }

            const year = new Date().getFullYear();
            const [count] = await db.query("SELECT COUNT(*) as c FROM complaints WHERE complaint_ref LIKE ?", [`CMP-${year}-%`]);
            const ref = `CMP-${year}-${String(count[0].c + 1).padStart(4, '0')}`;
            const attachmentUrl = req.file ? `/uploads/${req.user.role}/${req.user.id}/${req.file.filename}` : null;

            // Handle both JSON boolean and form-data string for is_anonymous
            const anonymous = is_anonymous === true || is_anonymous === 'true';

            await db.query(
                'INSERT INTO complaints (complaint_ref, title, student_id, is_anonymous, window_id, message, attachment_url, portal_type) VALUES (?,?,?,?,?,?,?,?)',
                [ref, title || 'General Complaint', anonymous ? null : req.user.id, anonymous ? 1 : 0, window[0].id, message, attachmentUrl, targetPortal]
            );

            res.status(201).json({ message: 'Complaint submitted', complaint_ref: ref, portal_type: targetPortal });
        } catch (err) {
            console.error('Submit complaint error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/complaints - list all complaints submitted by this student (non-anonymous)
    router.get('/complaints', async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT id, complaint_ref, COALESCE(title, 'Complaint') as title, message, status, 
                        admin_notes, submitted_at, updated_at,
                        COALESCE(portal_type, 'principal') as portal_type
                 FROM complaints
                 WHERE student_id = ?
                 ORDER BY submitted_at DESC`,
                [req.user.id]
            );
            res.json({ complaints: rows });
        } catch (err) {
            console.error('Get student complaints error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/complaint/:ref
    router.get('/complaint/:ref', async (req, res) => {
        try {
            const [rows] = await db.query('SELECT complaint_ref, status, admin_notes, submitted_at, updated_at FROM complaints WHERE complaint_ref=?', [req.params.ref]);
            if (rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });
            res.json({ complaint: rows[0] });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/student/placements
    router.get('/placements', async (req, res) => {
        try {
            // Get student's own profile first (dept, year, cgpa)
            const [profile] = await db.query(`
                SELECT sp.year, sp.semester, sp.department_id, d.code as dept_code,
                       COALESCE(
                         (SELECT sc.cgpa FROM student_cgpa sc WHERE sc.student_id = sp.user_id ORDER BY sc.updated_at DESC LIMIT 1),
                         0
                       ) as cgpa
                FROM student_profiles sp
                JOIN departments d ON sp.department_id = d.id
                WHERE sp.user_id = ?
            `, [req.user.id]);

            const studentDeptId = profile.length > 0 ? profile[0].department_id : null;

            // Show: principal jobs (department_id IS NULL, visible to all)
            //     + HOD jobs for student's own department
            const [rows] = await db.query(`
                SELECT * FROM placement_jobs
                WHERE department_id IS NULL
                   OR department_id = ?
                ORDER BY created_at DESC
            `, [studentDeptId]);

            const jobs = rows.map(j => ({
                ...j,
                eligible_years: typeof j.eligible_years === 'string' ? JSON.parse(j.eligible_years) : (j.eligible_years || []),
                eligible_departments: typeof j.eligible_departments === 'string' ? JSON.parse(j.eligible_departments) : (j.eligible_departments || []),
            }));

            res.json({
                jobs,
                student_profile: profile.length > 0 ? profile[0] : { year: null, dept_code: null, cgpa: 0 },
            });
        } catch (err) {
            console.error('Student placements error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });




// Helper: ensures backlog columns exist (compatible with MySQL 5.7+)
async function ensureBacklogsColumns() {
    try {
        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_backlogs'`
        );
        const names = cols.map(c => c.COLUMN_NAME);
        if (!names.includes('backlog_count')) {
            await db.query('ALTER TABLE student_backlogs ADD COLUMN backlog_count TINYINT UNSIGNED NOT NULL DEFAULT 1').catch(() => {});
        }
        if (!names.includes('status')) {
            await db.query("ALTER TABLE student_backlogs ADD COLUMN status ENUM('active','cleared','exempted') DEFAULT 'active'").catch(() => {});
        }
        if (!names.includes('subject_names_text')) {
            await db.query('ALTER TABLE student_backlogs ADD COLUMN subject_names_text TEXT NULL').catch(() => {});
        }
    } catch (e) { /* table may not exist yet â€” that's fine */ }
}

    // GET /api/student/backlogs â€” All backlogs set by faculty (consolidated into one summary)
    router.get('/backlogs', async (req, res) => {
        try {
            await ensureBacklogsColumns();
            // Consolidate all active backlog rows into a single summary
            // This handles the case where faculty entered from multiple assignment views
            const [rows] = await db.query(`
                SELECT
                    SUM(sb.backlog_count) as backlog_count,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(sb.backlog_type), '') ORDER BY sb.backlog_type SEPARATOR '/') as backlog_type,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(COALESCE(sb.subject_names_text, '')), '') SEPARATOR ', ') as subject_names_text,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(COALESCE(sb.reason, '')), '') SEPARATOR '; ') as reason,
                    MAX(sb.semester) as semester,
                    MAX(uf.full_name) as entered_by_name,
                    MAX(sb.updated_at) as updated_at,
                    'active' as status
                FROM student_backlogs sb
                JOIN users uf ON uf.id = sb.entered_by
                WHERE sb.student_id = ? AND sb.status = 'active'
                HAVING backlog_count > 0
            `, [req.user.id]);
            // Filter out null rows if no backlogs
            const backlogs = rows.filter(r => r.backlog_count > 0);
            res.json({ backlogs });
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ backlogs: [] });
            console.error('Student backlogs error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });


module.exports = router;
