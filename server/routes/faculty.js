const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.use(auth, roleGuard('faculty'));

// GET /api/faculty/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Today's classes — read from hod_timetables JSON (same source as /my-schedule)
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        const facultyUserId = req.user.id;

        const [allTimetables] = await db.query(`
            SELECT ht.department_id, ht.year, ht.section, ht.slots_json, d.name as dept_name
            FROM hod_timetables ht
            JOIN departments d ON d.id = ht.department_id
        `).catch(() => [[]]);

        const todayClasses = [];
        for (const tt of allTimetables) {
            let slots;
            try { slots = typeof tt.slots_json === 'string' ? JSON.parse(tt.slots_json) : tt.slots_json; }
            catch { continue; }
            if (!slots || typeof slots !== 'object') continue;

            const daySlots = slots[today];
            if (!Array.isArray(daySlots)) continue;

            for (let i = 0; i < daySlots.length; i++) {
                const slot = daySlots[i];
                if (!slot || slot.type === 'free') continue;
                if (String(slot.facultyId || '') !== String(facultyUserId)) continue;
                todayClasses.push({
                    subject_name: slot.subject || '',
                    subject_code: slot.subjectCode || '',
                    start_time: slot.startTime || '',
                    end_time: slot.endTime || '',
                    year: tt.year,
                    section: tt.section,
                    room: slot.room || '',
                    type: slot.type || 'class',
                    period: slot.period || (i + 1),
                    dept_name: tt.dept_name,
                    assignment_id: slot.assignmentId || null,
                });
            }
        }
        todayClasses.sort((a, b) => (a.period || 99) - (b.period || 99));

        // Pending student leaves
        const [pendingLeaves] = await db.query(
            "SELECT COUNT(*) as count FROM student_leaves WHERE faculty_id=? AND status='pending'",
            [req.user.id]
        );

        // Unread notices
        const [notices] = await db.query(`
      SELECT n.* FROM notices n
      WHERE (n.target_role IN ('all','faculty') 
        AND (n.target_department_id = ? OR n.target_department_id IS NULL))
      AND n.id NOT IN (SELECT notice_id FROM notice_reads WHERE user_id = ?)
      ORDER BY n.created_at DESC LIMIT 5
    `, [req.user.department_id, req.user.id]);

        // My leave status
        const [myLeaves] = await db.query(
            "SELECT * FROM faculty_leaves WHERE faculty_id=? ORDER BY created_at DESC LIMIT 5",
            [req.user.id]
        );

        // Attendance summary per assignment
        const [attSummary] = await db.query(`
      SELECT fa.id as assignment_id, s.name as subject_name, fa.year, fa.section,
        COUNT(DISTINCT a.date) as classes_taken
      FROM faculty_assignments fa
      JOIN subjects s ON fa.subject_id = s.id
      LEFT JOIN attendance a ON a.assignment_id = fa.id
      WHERE fa.faculty_id = ?
      GROUP BY fa.id
    `, [req.user.id]);

        res.json({ today_classes: todayClasses, pending_leaves: pendingLeaves[0].count, notices, my_leaves: myLeaves, attendance_summary: attSummary });
    } catch (err) {
        console.error('Faculty dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/assignments
router.get('/assignments', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT fa.*, s.name as subject_name, s.code as subject_code, s.credits, d.name as dept_name
      FROM faculty_assignments fa
      JOIN subjects s ON fa.subject_id = s.id
      JOIN departments d ON fa.department_id = d.id
      WHERE fa.faculty_id = ?
    `, [req.user.id]);
        res.json({ assignments: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/timetable
router.get('/timetable', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT t.*, s.name as subject_name, s.code, fa.year, fa.section
      FROM timetable t
      JOIN faculty_assignments fa ON t.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE fa.faculty_id = ?
      ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), t.start_time
    `, [req.user.id]);
        res.json({ timetable: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/active-periods — returns all configured class periods for period selector
router.get('/active-periods', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT cp.id, cp.period_number, cp.label, cp.start_time, cp.end_time,
             cp.window_open_before, cp.window_close_after
      FROM class_periods cp
      WHERE cp.department_id = ?
      ORDER BY cp.period_number
    `, [req.user.department_id]);
        res.json({ periods: rows });
    } catch (err) {
        // fallback: try without department filter in case table structure differs
        try {
            const [rows2] = await db.query('SELECT * FROM class_periods ORDER BY period_number');
            res.json({ periods: rows2 });
        } catch (e2) {
            console.error('active-periods error:', e2);
            res.json({ periods: [] });
        }
    }
});
// ─── Helper: ensure attendance_sessions has all required columns + class-level unique key ──
// ─── Local-date string for MySQL DATE comparisons ────────────────────────────
function todayIST() {
    // Use the server's local timezone (the server runs in IST/GMT+0530).
    // toISOString() always returns UTC which is 5:30 hours behind IST — wrong.
    // toLocaleDateString('en-CA') returns YYYY-MM-DD in the server's local tz.
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in server local tz
}

async function ensureSessionsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assignment_id INT NOT NULL,
            faculty_id INT NOT NULL,
            department_id INT NULL,
            year TINYINT NULL,
            section VARCHAR(10) NULL,
            session_date DATE NOT NULL,
            period_number TINYINT NULL,
            start_time TIME NULL,
            end_time TIME NULL,
            outside_window TINYINT(1) NOT NULL DEFAULT 0,
            hod_confirmed TINYINT(1) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // MySQL 5.7 compatible: check INFORMATION_SCHEMA before ALTER
    const dbName = (await db.query('SELECT DATABASE() as d'))[0][0].d;
    const [existing] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'`,
        [dbName]
    );
    const existingCols = existing.map(r => r.COLUMN_NAME);
    if (!existingCols.includes('outside_window')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN outside_window TINYINT(1) NOT NULL DEFAULT 0').catch(() => {});
    }
    if (!existingCols.includes('hod_confirmed')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN hod_confirmed TINYINT(1) DEFAULT NULL').catch(() => {});
    }
    if (!existingCols.includes('faculty_id')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN faculty_id INT NULL AFTER assignment_id').catch(() => {});
        await db.query(`
            UPDATE attendance_sessions ats
            JOIN faculty_assignments fa ON fa.id = ats.assignment_id
            SET ats.faculty_id = fa.faculty_id
            WHERE ats.faculty_id IS NULL
        `).catch(() => {});
    }
    if (!existingCols.includes('department_id')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN department_id INT NULL').catch(() => {});
    }
    if (!existingCols.includes('year')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN year TINYINT NULL').catch(() => {});
    }
    if (!existingCols.includes('section')) {
        await db.query('ALTER TABLE attendance_sessions ADD COLUMN section VARCHAR(10) NULL').catch(() => {});
    }
    // Backfill department_id/year/section for existing rows
    await db.query(`
        UPDATE attendance_sessions ats
        JOIN faculty_assignments fa ON fa.id = ats.assignment_id
        SET ats.department_id = fa.department_id, ats.year = fa.year, ats.section = fa.section
        WHERE ats.department_id IS NULL
    `).catch(() => {});
    // ── Drop old per-assignment unique key (allows duplicate cross-faculty entries) ──
    const [oldKeys] = await db.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
           AND INDEX_NAME IN ('uniq_session','uq_session')`,
        [dbName]
    ).catch(() => [[]]);
    for (const k of oldKeys) {
        await db.query(`ALTER TABLE attendance_sessions DROP INDEX \`${k.INDEX_NAME}\``).catch(() => {});
    }
    // ── Add class-level unique key (dept+year+section+date+period) ──
    const [newKey] = await db.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions' AND INDEX_NAME = 'uniq_class_period'`,
        [dbName]
    ).catch(() => [[]]);
    if (newKey.length === 0) {
        await db.query(`
            ALTER TABLE attendance_sessions
            ADD UNIQUE KEY uniq_class_period (department_id, year, section, session_date, period_number)
        `).catch(() => {});
    }
}

// ─── Ensure attendance_conflicts table exists ──────────────────────────────
async function ensureConflictsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS attendance_conflicts (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            department_id   INT NOT NULL,
            year            TINYINT NOT NULL,
            section         VARCHAR(10) NOT NULL,
            session_date    DATE NOT NULL,
            period_number   TINYINT NOT NULL,
            faculty_a_id    INT NOT NULL,
            faculty_b_id    INT NOT NULL,
            faculty_a_records JSON,
            faculty_b_records JSON,
            saved_at_offline  DATETIME NULL,
            resolved_by     INT NULL,
            resolution      ENUM('faculty_a','faculty_b') NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_conflict (department_id, year, section, session_date, period_number)
        )
    `).catch(() => {});
}

// GET /api/faculty/sessions/class-periods-status?assignment_id=&date=
// Returns all dept periods annotated with who (if anyone) has already taken each one today
router.get('/sessions/class-periods-status', async (req, res) => {
    try {
        const { assignment_id, date } = req.query;
        if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });

        // Resolve the class context for this assignment
        const [assign] = await db.query(
            'SELECT fa.department_id, fa.year, fa.section FROM faculty_assignments fa WHERE fa.id=? AND fa.faculty_id=?',
            [assignment_id, req.user.id]
        );
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });
        const { department_id, year, section } = assign[0];

        const checkDate = date || todayIST();

        // Get all periods for the dept
        const [periods] = await db.query(
            'SELECT id, period_number, label, start_time, end_time FROM class_periods WHERE department_id=? ORDER BY period_number',
            [department_id]
        ).catch(() => [[]]);

        if (periods.length === 0) return res.json({ periods: [] });

        // For each period, check if any faculty (same dept/year/section) has a session for it today
        // First try the fast path using department_id/year/section stored directly on sessions
        let sessions = [];
        try {
            const [rows] = await db.query(`
                SELECT
                    ats.period_number,
                    ats.faculty_id,
                    u.full_name AS faculty_name
                FROM attendance_sessions ats
                JOIN users u ON u.id = ats.faculty_id
                WHERE ats.department_id = ?
                  AND ats.year          = ?
                  AND ats.section       = ?
                  AND ats.session_date  = ?
            `, [department_id, year, section, checkDate]);
            sessions = rows;
        } catch (_e1) {
            // Fallback: join via faculty_assignments (for older rows without dept/year/section)
            try {
                const [rows2] = await db.query(`
                    SELECT
                        ats.period_number,
                        ats.faculty_id,
                        u.full_name AS faculty_name
                    FROM attendance_sessions ats
                    JOIN faculty_assignments fa ON fa.id = ats.assignment_id
                    JOIN users u ON u.id = ats.faculty_id
                    WHERE fa.department_id = ?
                      AND fa.year = ?
                      AND fa.section = ?
                      AND ats.session_date = ?
                `, [department_id, year, section, checkDate]);
                sessions = rows2;
            } catch (_e2) { sessions = []; }
        }

        // Build a map: period_number -> session info
        const sessionMap = {};
        for (const s of sessions) {
            sessionMap[s.period_number] = s;
        }

        const result = periods.map(p => {
            const sess = sessionMap[p.period_number];
            const lockedByMe    = sess ? Number(sess.faculty_id) === Number(req.user.id) : false;
            const lockedByOther = sess ? Number(sess.faculty_id) !== Number(req.user.id) : false;
            return {
                ...p,
                locked_by_me:    lockedByMe,
                locked_by_other: lockedByOther,
                locked_by_name:  lockedByOther ? sess.faculty_name : null,
            };
        });

        res.json({ periods: result });
    } catch (err) {
        console.error('class-periods-status error:', err);
        res.json({ periods: [] });
    }
});

// POST /api/faculty/sessions — Create an attendance session (with period_number)
router.post('/sessions', async (req, res) => {
    try {
        const { assignment_id, session_date, period_number, start_time, end_time } = req.body;
        if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });

        // Verify faculty owns assignment
        const [assign] = await db.query(
            'SELECT fa.*, d.id as dept_id FROM faculty_assignments fa JOIN departments d ON d.id = fa.department_id WHERE fa.id=? AND fa.faculty_id=?',
            [assignment_id, req.user.id]
        );
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });

        const deptId  = assign[0].department_id || assign[0].dept_id;
        const year    = assign[0].year;
        const section = assign[0].section;
        const todayStr = session_date || todayIST();

        // ── Detect outside-window (use IST-aware current time) ──────────────
        let outsideWindow = 0;
        if (start_time) {
            const [cp] = await db.query(
                'SELECT window_open_before, window_close_after FROM class_periods WHERE department_id=? AND period_number=?',
                [deptId, period_number ?? -1]
            ).catch(() => [[]]);
            const windowOpen  = cp[0]?.window_open_before  ?? 5;
            const windowClose = cp[0]?.window_close_after  ?? 10;

            const [sh, sm] = start_time.split(':').map(Number);
            const periodStartMins = sh * 60 + sm;
            // Server runs in IST (GMT+0530) natively — use local hours directly
            const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
            const diffMins = nowMins - periodStartMins;

            outsideWindow = (diffMins < -windowOpen || diffMins > windowClose) ? 1 : 0;
        }

        await ensureSessionsTable();

        // ── Cross-faculty duplicate guard (class-level) ──────────────────
        // Check if ANY other faculty (same dept/year/section) has already marked this period today
        if (period_number != null) {
            const [crossCheck] = await db.query(`
                SELECT ats.id, ats.faculty_id, u.full_name AS faculty_name
                FROM attendance_sessions ats
                JOIN users u ON u.id = ats.faculty_id
                WHERE ats.department_id = ?
                  AND ats.year          = ?
                  AND ats.section       = ?
                  AND ats.period_number = ?
                  AND ats.session_date  = ?
                  AND ats.faculty_id   != ?
                LIMIT 1
            `, [deptId, year, section, period_number, todayStr, req.user.id]);

            if (crossCheck.length > 0) {
                return res.status(409).json({
                    error: 'Period already taken',
                    taken_by: crossCheck[0].faculty_name,
                    taken_by_id: crossCheck[0].faculty_id,
                });
            }
        }

        // Check for existing session by THIS faculty for this class+period (today only)
        const [existing] = await db.query(
            `SELECT id, outside_window, hod_confirmed FROM attendance_sessions
             WHERE faculty_id=? AND department_id=? AND year=? AND section=? AND session_date=? AND period_number<=>?`,
            [req.user.id, deptId, year, section, todayStr, period_number ?? null]
        );
        if (existing.length > 0) {
            return res.json({
                session_id: existing[0].id,
                already_exists: true,
                outside_window: !!existing[0].outside_window,
                hod_confirmed: existing[0].hod_confirmed,
            });
        }

        const [result] = await db.query(
            `INSERT INTO attendance_sessions
             (assignment_id, faculty_id, department_id, year, section, session_date, period_number, start_time, end_time, outside_window, hod_confirmed, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                assignment_id, req.user.id, deptId, year, section, todayStr,
                period_number ?? null, start_time ?? null, end_time ?? null,
                outsideWindow,
                outsideWindow ? 0 : null,
                req.user.id,
            ]
        );
        res.status(201).json({
            session_id: result.insertId,
            outside_window: !!outsideWindow,
            hod_confirmed: outsideWindow ? 0 : null,
        });
    } catch (err) {
        console.error('Create session error:', err);
        // If duplicate key error, it means another faculty just beat us — return 409
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Period already taken by another faculty member' });
        }
        res.status(500).json({ error: 'Failed to create session: ' + err.message });
    }
});

// POST /api/faculty/sessions/:id/attendance — Save student records for a session
router.post('/sessions/:id/attendance', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        const { records } = req.body; // [{ student_id, status }]
        if (!records || records.length === 0) return res.status(400).json({ error: 'records required' });

        // Fetch session to get assignment + date
        const [sessions] = await db.query(
            'SELECT ats.*, fa.department_id, fa.year, fa.section FROM attendance_sessions ats JOIN faculty_assignments fa ON fa.id = ats.assignment_id WHERE ats.id=? AND ats.faculty_id=?',
            [sessionId, req.user.id]
        );
        if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
        const sess = sessions[0];

        // Save attendance records — one row per student per SESSION (period).
        // We include period_number so that multiple periods on the same day
        // create SEPARATE rows instead of overwriting the previous one.
        for (const r of records) {
            await db.query(
                `INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)`,
                [r.student_id, sess.assignment_id, sess.session_date, sess.period_number ?? null, r.status, req.user.id]
            );
        }

        const outsideWindow = !!sess.outside_window;
        res.json({
            message: 'Attendance saved',
            count: records.length,
            outside_window: outsideWindow,
            hod_confirmed: sess.hod_confirmed,
            window_note: outsideWindow
                ? `Submitted outside period window — pending HOD confirmation. Attendance will NOT count until HOD confirms.`
                : null,
        });
    } catch (err) {
        console.error('Save session attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/sessions/sync-offline — Sync an attendance entry saved while offline
// Called by the client's syncService when internet returns.
router.post('/sessions/sync-offline', async (req, res) => {
    try {
        const { assignment_id, session_date, period_number, start_time, end_time, records, saved_at } = req.body;
        if (!assignment_id || !records || records.length === 0)
            return res.status(400).json({ error: 'assignment_id and records required' });

        // Verify faculty owns assignment
        const [assign] = await db.query(
            'SELECT fa.*, d.id as dept_id FROM faculty_assignments fa JOIN departments d ON d.id = fa.department_id WHERE fa.id=? AND fa.faculty_id=?',
            [assignment_id, req.user.id]
        );
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });

        const deptId   = assign[0].department_id || assign[0].dept_id;
        const year     = assign[0].year;
        const section  = assign[0].section;
        const dateStr  = session_date || todayIST();

        await ensureSessionsTable();
        await ensureConflictsTable();

        // ── Cross-faculty conflict check ──────────────────────────────────────
        if (period_number != null) {
            const [crossCheck] = await db.query(`
                SELECT ats.id, ats.faculty_id, u.full_name AS faculty_name
                FROM attendance_sessions ats
                JOIN users u ON u.id = ats.faculty_id
                WHERE ats.department_id = ?
                  AND ats.year          = ?
                  AND ats.section       = ?
                  AND ats.period_number = ?
                  AND ats.session_date  = ?
                  AND ats.faculty_id   != ?
                LIMIT 1
            `, [deptId, year, section, period_number, dateStr, req.user.id]);

            if (crossCheck.length > 0) {
                // Log conflict for HOD to resolve
                await db.query(`
                    INSERT INTO attendance_conflicts
                    (department_id, year, section, session_date, period_number,
                     faculty_a_id, faculty_b_id, faculty_a_records, faculty_b_records, saved_at_offline)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                      faculty_b_id = VALUES(faculty_b_id),
                      faculty_b_records = VALUES(faculty_b_records),
                      updated_at = CURRENT_TIMESTAMP
                `, [
                    deptId, year, section, dateStr, period_number,
                    crossCheck[0].faculty_id, req.user.id,
                    JSON.stringify([]),         // faculty_a already in DB
                    JSON.stringify(records),    // faculty_b's offline submission
                    saved_at || null,
                ]).catch(() => {}); // non-fatal if table not ready

                return res.status(409).json({
                    error:    'Conflict — period already marked by another faculty',
                    taken_by: crossCheck[0].faculty_name,
                    conflict: true,
                });
            }
        }

        // ── Determine if saved_at was within the period window ─────────────────
        // Compare timestamp when faculty MARKED (saved_at) vs the period window.
        // Prevents gaming: going offline after period ends to submit fake attendance.
        let isOutsideWindow = false;
        let windowNote      = null;

        if (start_time && end_time && saved_at) {
            try {
                const [periodRows] = await db.query(
                    `SELECT window_open_before, window_close_after
                     FROM class_periods WHERE department_id=? AND period_number=? LIMIT 1`,
                    [deptId, period_number ?? null]
                ).catch(() => [[]]);

                const openBefore  = periodRows[0]?.window_open_before ?? 5;
                const closeAfter  = periodRows[0]?.window_close_after ?? 10;

                const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
                const savedDate   = new Date(saved_at);
                const savedMin    = savedDate.getHours() * 60 + savedDate.getMinutes();
                const windowStart = toMin(start_time) - openBefore;
                const windowEnd   = toMin(end_time)   + closeAfter;

                isOutsideWindow = savedMin < windowStart || savedMin > windowEnd;

                if (isOutsideWindow) {
                    const hh = String(savedDate.getHours()).padStart(2,'0');
                    const mm = String(savedDate.getMinutes()).padStart(2,'0');
                    windowNote = `Offline attendance marked at ${hh}:${mm} — outside Period ${period_number} window (${start_time.slice(0,5)}–${end_time.slice(0,5)}). Pending HOD confirmation.`;
                }
            } catch { /* non-fatal — default to within-window */ }
        }

        // ── Check if this faculty already submitted this period (idempotent) ──
        const [existing] = await db.query(
            `SELECT id FROM attendance_sessions
             WHERE faculty_id=? AND department_id=? AND year=? AND section=? AND session_date=? AND period_number<=>?`,
            [req.user.id, deptId, year, section, dateStr, period_number ?? null]
        );

        let sessionId;
        if (existing.length > 0) {
            sessionId = existing[0].id;
        } else {
            const [result] = await db.query(
                `INSERT INTO attendance_sessions
                 (assignment_id, faculty_id, department_id, year, section, session_date,
                  period_number, start_time, end_time, outside_window, hod_confirmed, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [assignment_id, req.user.id, deptId, year, section, dateStr,
                 period_number ?? null, start_time ?? null, end_time ?? null,
                 isOutsideWindow ? 1 : 0,
                 isOutsideWindow ? null : 1,
                 req.user.id]
            );
            sessionId = result.insertId;
        }

        // ── Save attendance records ─────────────────────────────────────────
        for (const r of records) {
            await db.query(
                `INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)`,
                [r.student_id, assignment_id, dateStr, period_number ?? null, r.status, req.user.id]
            );
        }

        res.json({
            message:        'Offline attendance synced',
            session_id:     sessionId,
            count:          records.length,
            outside_window: isOutsideWindow,
            window_note:    windowNote,
        });
    } catch (err) {
        console.error('sync-offline error:', err);
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Period already taken by another faculty member' });
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/faculty/sessions/today/:assignmentId — periods already saved today for this assignment
router.get('/sessions/today/:assignmentId', async (req, res) => {
    try {
        const today = todayIST(); // IST-aware date
        const [rows] = await db.query(`
      SELECT
        ats.id as session_id,
        ats.period_number,
        ats.start_time,
        ats.end_time,
        ats.outside_window,
        ats.hod_confirmed,
        ats.created_at,
        COUNT(a.id) as student_count
      FROM attendance_sessions ats
      LEFT JOIN attendance a ON a.assignment_id = ats.assignment_id AND a.date = ats.session_date
      WHERE ats.assignment_id = ?
        AND ats.faculty_id   = ?
        AND ats.session_date = ?
      GROUP BY ats.id
    `, [req.params.assignmentId, req.user.id, today]);
        res.json({ sessions: rows });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ sessions: [] });
        console.error('Sessions today error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/students/:assignmentId — Get all students for an assignment (by year/section/dept)
router.get('/students/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT * FROM faculty_assignments WHERE id=? AND faculty_id=?', [req.params.assignmentId, req.user.id]);
        if (assign.length === 0) return res.status(404).json({ error: 'Assignment not found' });
        const a = assign[0];
        const [rows] = await db.query(`
      SELECT u.id as student_id, u.full_name, sp.roll_number
      FROM users u
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE sp.department_id = ? AND sp.year = ? AND sp.section = ? AND u.role = 'student' AND u.is_active = TRUE
      ORDER BY sp.roll_number
    `, [a.department_id, a.year, a.section]);
        res.json({ students: rows });
    } catch (err) {
        console.error('Get students error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/attendance — Batch mark attendance
router.post('/attendance', async (req, res) => {
    try {
        const { assignment_id, date, records } = req.body;
        // records = [{ student_id, status }, ...]
        if (!assignment_id || !date || !records || records.length === 0) {
            return res.status(400).json({ error: 'Assignment ID, date, and records required' });
        }

        // Verify this assignment belongs to this faculty
        const [assign] = await db.query('SELECT * FROM faculty_assignments WHERE id=? AND faculty_id=?', [assignment_id, req.user.id]);
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });

        for (const r of records) {
            await db.query(
                `INSERT INTO attendance (student_id, assignment_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), edited_at=NOW()`,
                [r.student_id, assignment_id, date, r.status, req.user.id]
            );
        }

        // Check attendance threshold for alerts
        const { sendMail, attendanceWarningEmail } = require('../utils/mailer');
        const { sendSMS, sendWhatsApp, attendanceWarningMessage } = require('../utils/sms');

        const [alertConfig] = await db.query(
            'SELECT attendance_threshold, alert_channels FROM alert_config WHERE department_id=? OR department_id IS NULL ORDER BY department_id DESC LIMIT 1',
            [assign[0].department_id]
        );
        const threshold = alertConfig.length > 0 ? alertConfig[0].attendance_threshold : 75;

        // Recalculate for each student in this class
        const [attStats] = await db.query(`
      SELECT a.student_id, u.full_name, u.email, u.phone, sp.parent_email, sp.parent_phone,
        COUNT(*) as total,
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/COUNT(*), 2) as pct
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE a.assignment_id = ?
      GROUP BY a.student_id
      HAVING pct < ?
    `, [assignment_id, threshold]);

        const [subj] = await db.query('SELECT s.name FROM subjects s JOIN faculty_assignments fa ON fa.subject_id=s.id WHERE fa.id=?', [assignment_id]);
        const subjectName = subj.length > 0 ? subj[0].name : 'Unknown';

        // Check for recent alerts (avoid duplicates within 24h)
        for (const st of attStats) {
            const [recent] = await db.query(
                "SELECT id FROM notifications WHERE user_id=? AND type='alert' AND reference_id=? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)",
                [st.student_id, assignment_id]
            );
            if (recent.length === 0) {
                // In-portal notification
                await db.query(
                    'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?,?,?,?,?)',
                    [st.student_id, 'Attendance Warning', `Your attendance in ${subjectName} is ${st.pct}%`, 'alert', assignment_id]
                );
                // Email
                if (st.email) {
                    const emailData = attendanceWarningEmail(st.full_name, subjectName, st.pct, st.attended, st.total);
                    sendMail(st.email, emailData.subject, emailData.html);
                }
                if (st.parent_email) {
                    const emailData = attendanceWarningEmail(st.full_name, subjectName, st.pct, st.attended, st.total);
                    sendMail(st.parent_email, emailData.subject, emailData.html);
                }
                // SMS & WhatsApp
                const msg = attendanceWarningMessage(st.full_name, subjectName, st.pct, st.attended, st.total);
                if (st.phone) { sendSMS(st.phone, msg); sendWhatsApp(st.phone, msg); }
                if (st.parent_phone) { sendSMS(st.parent_phone, msg); sendWhatsApp(st.parent_phone, msg); }
            }
        }

        res.json({ message: 'Attendance marked', alerts_sent: attStats.length });
    } catch (err) {
        console.error('Mark attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/attendance/:assignmentId
router.get('/attendance/:assignmentId', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT a.*, u.full_name, sp.roll_number
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE a.assignment_id = ?
      ORDER BY a.date DESC, sp.roll_number
    `, [req.params.assignmentId]);
        res.json({ attendance: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/attendance/:id — Edit within 24 hours
router.patch('/attendance/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const [att] = await db.query('SELECT * FROM attendance WHERE id=? AND marked_by=?', [req.params.id, req.user.id]);
        if (att.length === 0) return res.status(404).json({ error: 'Record not found' });

        // Check edit window (24 hours)
        const markedAt = new Date(att[0].marked_at);
        const now = new Date();
        if ((now - markedAt) > 24 * 60 * 60 * 1000) {
            return res.status(403).json({ error: 'Edit window expired (24 hours)' });
        }

        await db.query('UPDATE attendance SET status=?, edited_at=NOW() WHERE id=?', [status, req.params.id]);
        res.json({ message: 'Attendance updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/attendance/percentage/:assignmentId
router.get('/attendance/percentage/:assignmentId', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT a.student_id, u.full_name, sp.roll_number,
        COUNT(*) as total_classes,
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) as percentage
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE a.assignment_id = ?
        AND NOT EXISTS (
          -- Exclude attendance for dates that have an outside-window, unconfirmed session
          SELECT 1 FROM attendance_sessions ats
          WHERE ats.assignment_id = a.assignment_id
            AND ats.session_date  = a.date
            AND ats.outside_window = 1
            AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
        )
      GROUP BY a.student_id
      ORDER BY sp.roll_number
    `, [req.params.assignmentId]);
        res.json({ students: rows });
    } catch (err) {
        // If attendance_sessions doesn't exist yet, fall back to unfiltered query
        if (err.code === 'ER_NO_SUCH_TABLE') {
            try {
                const [rows2] = await db.query(`
                  SELECT a.student_id, u.full_name, sp.roll_number,
                    COUNT(*) as total_classes,
                    SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
                    ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) as percentage
                  FROM attendance a
                  JOIN users u ON a.student_id = u.id
                  JOIN student_profiles sp ON sp.user_id = u.id
                  WHERE a.assignment_id = ?
                  GROUP BY a.student_id ORDER BY sp.roll_number
                `, [req.params.assignmentId]);
                return res.json({ students: rows2 });
            } catch { }
        }
        console.error('Attendance percentage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/attendance/bunkers
router.get('/attendance/bunkers', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT u.full_name, sp.roll_number, s.name as subject_name,
        COUNT(*) as total,
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        COUNT(*) - SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as missed,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/COUNT(*), 2) as percentage
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN faculty_assignments fa ON a.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE fa.faculty_id = ?
      GROUP BY a.student_id, a.assignment_id
      HAVING percentage < 75
      ORDER BY percentage ASC
    `, [req.user.id]);
        res.json({ bunkers: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Ensure the marks table exists
async function ensureMarksTable() {
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
}

// POST /api/faculty/marks
router.post('/marks', async (req, res) => {
    try {
        const { subject_id, academic_year_id, semester, exam_type, exam_label, entries } = req.body;
        // entries = [{ student_id, marks_obtained, max_marks }, ...]
        if (!subject_id || !entries || entries.length === 0) {
            return res.status(400).json({ error: 'Subject and entries required' });
        }

        await ensureMarksTable();

        const ayId = academic_year_id || 1;
        for (const e of entries) {
            await db.query(
                `INSERT INTO marks
                 (student_id, subject_id, academic_year_id, semester, exam_type, exam_label, marks_obtained, max_marks, entered_by, is_published)
                 VALUES (?,?,?,?,?,?,?,?,?,1)
                 ON DUPLICATE KEY UPDATE
                   marks_obtained = VALUES(marks_obtained),
                   max_marks      = VALUES(max_marks),
                   entered_by     = VALUES(entered_by),
                   is_published   = 1`,
                [e.student_id, subject_id, ayId, semester, exam_type, exam_label, e.marks_obtained, e.max_marks, req.user.id]
            );
        }
        res.status(201).json({ message: `${entries.length} marks entries saved` });
    } catch (err) {
        console.error('Enter marks error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/faculty/marks/all — All marks entered by this faculty (for their view/edit page)
router.get('/marks/all', async (req, res) => {
    try {
        await ensureMarksTable();

        // Ensure locked column exists (older installs may not have it)
        await db.query('ALTER TABLE marks ADD COLUMN IF NOT EXISTS locked TINYINT(1) NOT NULL DEFAULT 0').catch(() => {});

        const { assignment_id } = req.query;
        let sql = `
            SELECT m.id, m.student_id, m.subject_id, m.exam_type, m.exam_label,
                   m.marks_obtained, m.max_marks, m.is_published,
                   COALESCE(m.locked, 0) as locked, m.created_at,
                   u.full_name, sp.roll_number, s.name as subject_name
            FROM marks m
            JOIN users u ON m.student_id = u.id
            JOIN student_profiles sp ON sp.user_id = u.id
            JOIN subjects s ON m.subject_id = s.id
            WHERE m.entered_by = ?
        `;
        const params = [req.user.id];
        if (assignment_id) {
            const [assign] = await db.query('SELECT subject_id FROM faculty_assignments WHERE id=? AND faculty_id=?', [assignment_id, req.user.id]);
            if (assign.length > 0) {
                sql += ' AND m.subject_id = ?';
                params.push(assign[0].subject_id);
            }
        }
        sql += ' ORDER BY s.name, m.exam_type, m.exam_label, sp.roll_number';
        const [rows] = await db.query(sql, params);
        res.json({ marks: rows });
    } catch (err) {
        console.error('Get all faculty marks error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});


// PUT /api/faculty/marks/:id
router.put('/marks/:id', async (req, res) => {
    try {
        const { marks_obtained, max_marks } = req.body;
        // Check if locked
        const [mark] = await db.query('SELECT * FROM marks WHERE id=? AND entered_by=?', [req.params.id, req.user.id]);
        if (mark.length === 0) return res.status(404).json({ error: 'Mark not found' });
        if (mark[0].locked) return res.status(403).json({ error: 'Marks are locked by HOD' });

        await db.query(
            'UPDATE marks SET marks_obtained=?, max_marks=COALESCE(?,max_marks) WHERE id=?',
            [marks_obtained, max_marks ?? null, req.params.id]
        );
        res.json({ message: 'Mark updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/faculty/marks/:id — delete a single student's mark record
router.delete('/marks/:id', async (req, res) => {
    try {
        const [mark] = await db.query('SELECT * FROM marks WHERE id=? AND entered_by=?', [req.params.id, req.user.id]);
        if (mark.length === 0) return res.status(404).json({ error: 'Mark not found or not yours' });
        if (mark[0].locked) return res.status(403).json({ error: 'Marks are locked by HOD' });
        await db.query('DELETE FROM marks WHERE id=?', [req.params.id]);
        res.json({ message: 'Mark deleted' });
    } catch (err) {
        console.error('Delete mark error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/faculty/marks/bulk — delete ALL marks for a subject+exam_label entered by this faculty
// Body: { subject_id, exam_label }
router.delete('/marks/bulk', async (req, res) => {
    try {
        const { subject_id, exam_label } = req.body;
        if (!subject_id || !exam_label) return res.status(400).json({ error: 'subject_id and exam_label required' });
        // Respect locked flag — refuse if any row is locked
        const [locked] = await db.query(
            'SELECT COUNT(*) as cnt FROM marks WHERE subject_id=? AND exam_label=? AND entered_by=? AND locked=1',
            [subject_id, exam_label, req.user.id]
        );
        if (locked[0].cnt > 0) return res.status(403).json({ error: 'Some marks are locked by HOD' });
        const [result] = await db.query(
            'DELETE FROM marks WHERE subject_id=? AND exam_label=? AND entered_by=?',
            [subject_id, exam_label, req.user.id]
        );
        res.json({ message: `${result.affectedRows} mark(s) deleted` });
    } catch (err) {
        console.error('Bulk delete marks error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/marks/:assignmentId
router.get('/marks/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT subject_id FROM faculty_assignments WHERE id=?', [req.params.assignmentId]);
        if (assign.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        const [rows] = await db.query(`
      SELECT m.*, u.full_name, sp.roll_number
      FROM marks m
      JOIN users u ON m.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE m.subject_id = ? AND m.entered_by = ?
      ORDER BY sp.roll_number, m.exam_type
    `, [assign[0].subject_id, req.user.id]);
        res.json({ marks: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/marks/stats/:assignmentId
router.get('/marks/stats/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT subject_id FROM faculty_assignments WHERE id=?', [req.params.assignmentId]);
        if (assign.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        const [stats] = await db.query(`
      SELECT exam_type, exam_label,
        COUNT(*) as total_students,
        ROUND(AVG(marks_obtained), 2) as avg_marks,
        MAX(marks_obtained) as highest,
        MIN(marks_obtained) as lowest,
        MAX(max_marks) as max_marks
      FROM marks
      WHERE subject_id = ?
      GROUP BY exam_type, exam_label
    `, [assign[0].subject_id]);
        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/marks/check/:assignmentId — returns existing marks with who entered them
// Used for cross-faculty edit detection
router.get('/marks/check/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT subject_id FROM faculty_assignments WHERE id=?', [req.params.assignmentId]);
        if (assign.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        await ensureMarksTable();

        const [rows] = await db.query(`
      SELECT m.id, m.student_id, m.exam_type, m.exam_label, m.marks_obtained, m.max_marks,
        m.entered_by, u.full_name as entered_by_name,
        (m.entered_by != ?) as entered_by_other
      FROM marks m
      JOIN users u ON u.id = m.entered_by
      WHERE m.subject_id = ? AND m.is_published = 1
      ORDER BY m.exam_type, m.exam_label
    `, [req.user.id, assign[0].subject_id]);
        res.json({ marks: rows, current_faculty_id: req.user.id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/subjects — All subjects in faculty's department (for backlog subject picker)
router.get('/subjects', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, name, code, semester FROM subjects WHERE department_id = ? ORDER BY semester, name',
            [req.user.department_id]
        );
        res.json({ subjects: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Ensure student_backlogs table has backlog_count column
async function ensureBacklogsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS student_backlogs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            subject_id INT NOT NULL,
            academic_year_id INT NOT NULL DEFAULT 1,
            semester TINYINT NOT NULL DEFAULT 1,
            reason VARCHAR(500),
            backlog_type ENUM('academic','attendance','other') DEFAULT 'academic',
            backlog_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
            entered_by INT NOT NULL,
            status ENUM('active','cleared','exempted') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_backlog (student_id, subject_id, academic_year_id)
        )
    `).catch(() => {});

    // Safe migration: add missing columns using information_schema (compatible with MySQL 5.7+)
    // This avoids relying on "ADD COLUMN IF NOT EXISTS" which requires MySQL 8.0.3+
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_backlogs'`
    ).catch(() => [[]]);
    const existingCols = cols.map(c => c.COLUMN_NAME);

    if (!existingCols.includes('backlog_count')) {
        await db.query('ALTER TABLE student_backlogs ADD COLUMN backlog_count TINYINT UNSIGNED NOT NULL DEFAULT 1').catch(() => {});
    }
    if (!existingCols.includes('status')) {
        await db.query("ALTER TABLE student_backlogs ADD COLUMN status ENUM('active','cleared','exempted') DEFAULT 'active'").catch(() => {});
    }
    if (!existingCols.includes('subject_names_text')) {
        await db.query('ALTER TABLE student_backlogs ADD COLUMN subject_names_text TEXT NULL').catch(() => {});
    }
}

// POST /api/faculty/backlogs — Manual backlog entry per student
// entries = [{ student_id, backlog_count, subject_names_text, semester, reason, backlog_type }]
router.post('/backlogs', async (req, res) => {
    try {
        const { entries } = req.body;
        if (!entries || entries.length === 0) {
            return res.status(400).json({ error: 'entries required' });
        }

        await ensureBacklogsTable();

        const [ay] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
        const ayId = ay.length ? ay[0].id : 1;

        let totalSaved = 0;
        for (const e of entries) {
            const semester = e.semester || 1;
            const count = Math.max(1, parseInt(e.backlog_count) || 1);
            const subjectText = (e.subject_names_text || '').trim() || null;

            // subject_id = 0 used as placeholder for manually-entered backlogs
            await db.query(
                `INSERT INTO student_backlogs
                 (student_id, subject_id, academic_year_id, semester, reason, backlog_type, backlog_count, entered_by, status, subject_names_text)
                 VALUES (?, 0, ?, ?, ?, ?, ?, ?, 'active', ?)
                 ON DUPLICATE KEY UPDATE
                   reason=VALUES(reason),
                   backlog_type=VALUES(backlog_type),
                   backlog_count=VALUES(backlog_count),
                   entered_by=VALUES(entered_by),
                   status='active',
                   subject_names_text=VALUES(subject_names_text),
                   updated_at=NOW()`,
                [e.student_id, ayId, semester, e.reason || null,
                 e.backlog_type || 'academic', count, req.user.id, subjectText]
            );
            totalSaved++;
        }
        res.status(201).json({ message: `${totalSaved} backlog entries saved` });
    } catch (err) {
        console.error('Manual backlog error:', err.message, err.code);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/faculty/backlogs/:assignmentId — Get backlogs for students in an assignment
router.get('/backlogs/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT * FROM faculty_assignments WHERE id=? AND faculty_id=?', [req.params.assignmentId, req.user.id]);
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });
        const a = assign[0];

        await ensureBacklogsTable();

        const [rows] = await db.query(`
      SELECT sb.student_id, sb.backlog_type, sb.backlog_count,
             sb.reason, sb.status, sb.semester, sb.subject_names_text,
             u.full_name, sp.roll_number,
             uf.full_name as entered_by_name
      FROM student_backlogs sb
      JOIN users u ON u.id = sb.student_id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN users uf ON uf.id = sb.entered_by
      WHERE sp.department_id = ? AND sp.year = ? AND sp.section = ?
        AND sb.status = 'active'
      ORDER BY sp.roll_number
    `, [a.department_id, a.year, a.section]);
        res.json({ backlogs: rows });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ backlogs: [] });
        console.error('Faculty backlogs GET error:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// DELETE /api/faculty/backlogs/:studentId — Remove (clear) a student's active backlog
router.delete('/backlogs/:studentId', async (req, res) => {
    try {
        await ensureBacklogsTable();

        // Delete ALL active backlog rows for this student regardless of subject_id.
        // Backlogs may exist with subject_id=0 (manual entry) or a real subject_id
        // (entered via older code paths), so we must not filter by subject_id.
        const [result] = await db.query(
            `DELETE FROM student_backlogs WHERE student_id = ?`,
            [req.params.studentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No active backlog found for this student' });
        }

        res.json({ message: 'Backlog removed successfully' });
    } catch (err) {
        console.error('Delete backlog error:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// POST /api/faculty/backlogs/remove-bulk — Remove backlogs for multiple students
router.post('/backlogs/remove-bulk', async (req, res) => {
    try {
        const { student_ids } = req.body;
        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({ error: 'student_ids required' });
        }

        await ensureBacklogsTable();

        // Delete ALL backlog rows for these students regardless of subject_id or academic_year_id.
        // Backlogs can exist with subject_id=0 (manual) or a real subject_id (old code path).
        // Filtering by subject_id=0 caused silent 0-row deletes for older entries.
        const placeholders = student_ids.map(() => '?').join(',');
        const [result] = await db.query(
            `DELETE FROM student_backlogs WHERE student_id IN (${placeholders})`,
            [...student_ids]
        );

        res.json({ message: `${result.affectedRows} backlog(s) removed` });
    } catch (err) {
        console.error('Bulk remove backlog error:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// ── Ensure student_cgpa table exists ────────────────────────────────────────
async function ensureStudentCgpaTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS student_cgpa (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            academic_year_id INT NOT NULL DEFAULT 1,
            semester TINYINT NOT NULL DEFAULT 1,
            cgpa DECIMAL(4,2) NULL,
            sgpa DECIMAL(4,2) NULL,
            entered_by INT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_student_cgpa (student_id, academic_year_id)
        )
    `).catch(() => {});
}

// POST /api/faculty/cgpa — Manual CGPA/SGPA entry per student
router.post('/cgpa', async (req, res) => {
    try {
        const { entries } = req.body;
        if (!entries || entries.length === 0) return res.status(400).json({ error: 'entries required' });

        await ensureStudentCgpaTable();

        const [ay] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
        const ayId = ay.length ? ay[0].id : 1;

        for (const e of entries) {
            await db.query(
                `INSERT INTO student_cgpa (student_id, academic_year_id, semester, cgpa, sgpa, entered_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   cgpa = VALUES(cgpa), sgpa = VALUES(sgpa),
                   semester = VALUES(semester),
                   entered_by = VALUES(entered_by),
                   updated_at = NOW()`,
                [e.student_id, ayId, e.semester || 1,
                 e.cgpa != null ? parseFloat(e.cgpa) : null,
                 e.sgpa != null ? parseFloat(e.sgpa) : null,
                 req.user.id]
            );
        }
        res.status(201).json({ message: `${entries.length} CGPA entries saved` });
    } catch (err) {
        console.error('Manual CGPA error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/faculty/cgpa/:assignmentId — Get CGPA/SGPA for students in an assignment
router.get('/cgpa/:assignmentId', async (req, res) => {
    try {
        const [assign] = await db.query('SELECT * FROM faculty_assignments WHERE id=? AND faculty_id=?', [req.params.assignmentId, req.user.id]);
        if (assign.length === 0) return res.status(403).json({ error: 'Not your assignment' });
        const a = assign[0];

        await ensureStudentCgpaTable();

        const [ay] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
        const ayId = ay.length ? ay[0].id : 1;

        const [students] = await db.query(`
            SELECT u.id as student_id, u.full_name, sp.roll_number,
                sc.cgpa, sc.sgpa
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN student_cgpa sc ON sc.student_id = u.id AND sc.academic_year_id = ?
            WHERE sp.department_id = ? AND sp.year = ? AND sp.section = ?
              AND u.role = 'student' AND u.is_active = TRUE
            ORDER BY sp.roll_number
        `, [ayId, a.department_id, a.year, a.section]);
        res.json({ students });
    } catch (err) {
        console.error('CGPA get error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/student-leaves
router.get('/student-leaves', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT sl.*, u.full_name, sp.roll_number
      FROM student_leaves sl
      JOIN users u ON sl.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE sl.faculty_id = ?
      ORDER BY sl.created_at DESC
    `, [req.user.id]);
        res.json({ leaves: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/student-leaves/:id
router.patch('/student-leaves/:id', async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const [leave] = await db.query('SELECT * FROM student_leaves WHERE id=? AND faculty_id=?', [req.params.id, req.user.id]);
        if (leave.length === 0) return res.status(404).json({ error: 'Leave not found' });

        await db.query('UPDATE student_leaves SET status=?, remarks=?, updated_at=NOW() WHERE id=?',
            [status, remarks, req.params.id]);

        if (status === 'approved') {
            // Update attendance records to 'leave' for those dates
            const fromDate = leave[0].from_date;
            const toDate = leave[0].to_date;
            // Get all assignments where this faculty is class teacher for this student
            const [assignments] = await db.query(`
        SELECT fa.id FROM faculty_assignments fa
        JOIN student_profiles sp ON sp.department_id = fa.department_id AND sp.year = fa.year AND sp.section = fa.section
        WHERE sp.user_id = ? AND fa.faculty_id = ?
      `, [leave[0].student_id, req.user.id]);

            for (const a of assignments) {
                await db.query(
                    `UPDATE attendance SET status='leave', edited_at=NOW() 
           WHERE student_id=? AND assignment_id=? AND date BETWEEN ? AND ?`,
                    [leave[0].student_id, a.id, fromDate, toDate]
                );
            }
        }

        // Notify student
        await db.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?,?,?,?,?)',
            [leave[0].student_id, `Leave ${status}`, `Your leave request has been ${status}. ${remarks || ''}`, 'leave', req.params.id]
        );

        res.json({ message: `Leave ${status}` });
    } catch (err) {
        console.error('Student leave approval error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/faculty-leaves
router.post('/faculty-leaves', async (req, res) => {
    try {
        const { leave_type, from_date, to_date, reason } = req.body;
        if (!leave_type || !from_date || !to_date || !reason) {
            return res.status(400).json({ error: 'All fields required' });
        }
        // Find HOD
        const [hod] = await db.query(
            "SELECT id FROM users WHERE department_id=? AND role='hod' AND is_active=TRUE LIMIT 1",
            [req.user.department_id]
        );
        if (hod.length === 0) return res.status(400).json({ error: 'No HOD found for your department' });

        const [result] = await db.query(
            'INSERT INTO faculty_leaves (faculty_id, hod_id, leave_type, from_date, to_date, reason) VALUES (?,?,?,?,?,?)',
            [req.user.id, hod[0].id, leave_type, from_date, to_date, reason]
        );

        // Notify HOD
        await db.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?,?,?,?,?)',
            [hod[0].id, 'New Leave Request', `${req.user.full_name} has requested leave from ${from_date} to ${to_date}`, 'leave', result.insertId]
        );

        res.status(201).json({ message: 'Leave request submitted', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/faculty-leaves
router.get('/faculty-leaves', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM faculty_leaves WHERE faculty_id=? ORDER BY created_at DESC', [req.user.id]);
        res.json({ leaves: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/projects — All projects in faculty's department
// Query params: year, section, type (project|course|certification), status (pending|verified|rejected)
router.get('/projects', async (req, res) => {
    try {
        // Ensure columns exist (safe migration)
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending'`).catch(() => {});
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL`).catch(() => {});
        await db.query(`ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS project_link VARCHAR(500) NULL`).catch(() => {});

        const { year, section, type, status } = req.query;

        let sql = `
      SELECT sp2.*, u.full_name, spr.roll_number, spr.year, spr.section, spr.semester
      FROM student_projects sp2
      JOIN users u ON sp2.student_id = u.id
      JOIN student_profiles spr ON spr.user_id = u.id
      WHERE spr.department_id = ?
    `;
        const params = [req.user.department_id];

        if (year)    { sql += ' AND spr.year = ?';    params.push(year); }
        if (section) { sql += ' AND spr.section = ?'; params.push(section); }
        if (type)    { sql += ' AND sp2.type = ?';    params.push(type); }
        if (status === 'verified') { sql += ' AND sp2.is_verified = TRUE'; }
        else if (status === 'rejected') { sql += " AND sp2.status = 'rejected'"; }
        else if (status === 'pending')  { sql += " AND sp2.is_verified = FALSE AND (sp2.status IS NULL OR sp2.status = 'pending')"; }

        sql += ' ORDER BY spr.year, spr.section, spr.roll_number, sp2.created_at DESC';

        const [rows] = await db.query(sql, params);

        // Also return distinct years and sections available (for filter dropdowns)
        const [meta] = await db.query(`
            SELECT DISTINCT spr.year, spr.section
            FROM student_projects sp2
            JOIN student_profiles spr ON spr.user_id = sp2.student_id
            WHERE spr.department_id = ?
            ORDER BY spr.year, spr.section
        `, [req.user.department_id]);

        res.json({ projects: rows, meta });
    } catch (err) {
        console.error('Faculty projects error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// GET /api/faculty/projects/verify (legacy — pending only)
router.get('/projects/verify', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT sp2.*, u.full_name, spr.roll_number
      FROM student_projects sp2
      JOIN users u ON sp2.student_id = u.id
      JOIN student_profiles spr ON spr.user_id = u.id
      WHERE spr.department_id = ? AND sp2.is_verified = FALSE AND (sp2.status IS NULL OR sp2.status = 'pending')
      ORDER BY sp2.created_at DESC
    `, [req.user.department_id]);
        res.json({ projects: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/projects/:id/verify
router.patch('/projects/:id/verify', async (req, res) => {
    try {
        await db.query(
            'UPDATE student_projects SET is_verified=TRUE, status="verified", verified_by=? WHERE id=?',
            [req.user.id, req.params.id]
        );
        res.json({ message: 'Project verified' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/projects/:id/unverify
router.patch('/projects/:id/unverify', async (req, res) => {
    try {
        await db.query(
            'UPDATE student_projects SET is_verified=FALSE, status="pending", verified_by=NULL WHERE id=?',
            [req.params.id]
        );
        res.json({ message: 'Project unverified' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/projects/:id/reject
router.patch('/projects/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body;
        await db.query(
            'UPDATE student_projects SET is_verified=FALSE, status="rejected", rejection_reason=? WHERE id=?',
            [reason || null, req.params.id]
        );
        res.json({ message: 'Project rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/faculty/projects/:id
router.delete('/projects/:id', async (req, res) => {
    try {
        // Ensure it belongs to faculty's department
        const [row] = await db.query(`
            SELECT sp2.id FROM student_projects sp2
            JOIN student_profiles spr ON spr.user_id = sp2.student_id
            WHERE sp2.id = ? AND spr.department_id = ?
        `, [req.params.id, req.user.department_id]);
        if (!row.length) return res.status(404).json({ error: 'Project not found in your department' });

        await db.query('DELETE FROM student_projects WHERE id=?', [req.params.id]);
        res.json({ message: 'Project deleted' });
    } catch (err) {
        console.error('Delete project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/notices
router.post('/notices', async (req, res) => {
    try {
        const { title, body, target_year, target_section, priority } = req.body;
        const [result] = await db.query(
            `INSERT INTO notices (title, body, created_by, target_role, target_department_id, target_year, target_section, priority)
       VALUES (?,?,'student',?,?,?,?)`,
            [title, body, req.user.id, req.user.department_id, target_year, target_section, priority || 'general']
        );
        const noticeId = result.insertId;
        // Fan-out to notifications so students' bell reflects this notice
        try {
            const { notifyStudentsInDept } = require('../utils/notificationService');
            const notifMsg = body?.substring(0, 120) || '';
            await notifyStudentsInDept({ deptId: req.user.department_id, year: target_year || null, section: target_section || null, title, message: notifMsg, type: 'notice', referenceId: noticeId });
        } catch (_e) { /* non-critical */ }
        res.status(201).json({ message: 'Notice posted', id: noticeId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/notices
router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT n.*, 
        CASE WHEN nr.id IS NOT NULL THEN TRUE ELSE FALSE END as is_read
      FROM notices n
      LEFT JOIN notice_reads nr ON nr.notice_id = n.id AND nr.user_id = ?
      WHERE n.target_role IN ('all','faculty')
        AND (n.target_department_id = ? OR n.target_department_id IS NULL)
      ORDER BY n.created_at DESC
    `, [req.user.id, req.user.department_id]);

        // Auto-mark all notice bell notifications as read when user opens the Notices page
        db.query(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND type = 'notice' AND is_read = FALSE`,
            [req.user.id]
        ).catch(() => {});

        res.json({ notices: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/notices/:id/read — mark a single notice as read (notice_reads)
router.patch('/notices/:id/read', async (req, res) => {
    try {
        await db.query(
            'INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?,?)',
            [req.params.id, req.user.id]
        );
        // Also clear the bell notification for this notice
        db.query(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND type = 'notice' AND reference_id = ?`,
            [req.user.id, req.params.id]
        ).catch(() => {});
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/polls
router.get('/polls', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM poll_responses WHERE poll_id=p.id AND respondent_id=?) as my_responses
      FROM polls p
      ORDER BY p.open_date DESC
    `, [req.user.id]);
        res.json({ polls: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/polls/:id/questions
router.get('/polls/:id/questions', async (req, res) => {
    try {
        const [poll] = await db.query('SELECT * FROM polls WHERE id = ?', [req.params.id]);
        if (poll.length === 0) return res.status(404).json({ error: 'Poll not found' });
        const [questions] = await db.query('SELECT * FROM poll_questions WHERE poll_id = ? ORDER BY id', [req.params.id]);
        // Check if already responded
        const [existing] = await db.query('SELECT COUNT(*) as c FROM poll_responses WHERE poll_id = ? AND respondent_id = ?', [req.params.id, req.user.id]);
        res.json({ poll: poll[0], questions, already_responded: existing[0].c > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/polls/:id/respond
router.post('/polls/:id/respond', async (req, res) => {
    try {
        const { responses } = req.body;
        const [poll] = await db.query('SELECT * FROM polls WHERE id=?', [req.params.id]);
        if (poll.length === 0) return res.status(404).json({ error: 'Poll not found' });

        // Check already responded
        const [existing] = await db.query('SELECT COUNT(*) as c FROM poll_responses WHERE poll_id = ? AND respondent_id = ?', [req.params.id, req.user.id]);
        if (existing[0].c > 0) return res.status(409).json({ error: 'You have already responded to this poll' });

        for (const r of responses) {
            await db.query(
                'INSERT INTO poll_responses (poll_id, question_id, respondent_id, response_text, selected_option, rating_value) VALUES (?,?,?,?,?,?)',
                [req.params.id, r.question_id, poll[0].is_anonymous ? null : req.user.id, r.response_text, r.selected_option, r.rating_value]
            );
        }
        res.json({ message: 'Poll response submitted' });
    } catch (err) {
        console.error('Poll respond error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/calendar
router.get('/calendar', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM calendar_events WHERE department_id=? OR department_id IS NULL ORDER BY event_date',
            [req.user.department_id]
        );
        res.json({ events: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/placements — read-only view of all placement jobs
router.get('/placements', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM placement_jobs ORDER BY created_at DESC');
        const jobs = rows.map(j => ({
            ...j,
            eligible_years: typeof j.eligible_years === 'string' ? JSON.parse(j.eligible_years) : (j.eligible_years || []),
            eligible_departments: typeof j.eligible_departments === 'string' ? JSON.parse(j.eligible_departments) : (j.eligible_departments || []),
        }));
        res.json({ jobs });
    } catch (err) {
        console.error('Faculty placements error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── ATTENDANCE SESSIONS (Per-Period Tracking) ────────────────────────────────

// POST /api/faculty/sessions — Create or upsert an attendance session
router.post('/sessions', async (req, res) => {
    try {
        const { assignment_id, session_date, period_number, start_time, end_time } = req.body;
        if (!assignment_id || !session_date || !period_number || !start_time || !end_time) {
            return res.status(400).json({ error: 'assignment_id, session_date, period_number, start_time, end_time required' });
        }

        // Verify faculty owns this assignment
        const [assign] = await db.query(
            'SELECT * FROM faculty_assignments WHERE id = ? AND faculty_id = ?',
            [assignment_id, req.user.id]
        );
        if (!assign.length) return res.status(403).json({ error: 'Not your assignment' });

        const [result] = await db.query(
            `INSERT INTO attendance_sessions (assignment_id, session_date, period_number, start_time, end_time, status, created_by)
             VALUES (?, ?, ?, ?, ?, 'conducted', ?)
             ON DUPLICATE KEY UPDATE status = 'conducted', start_time = VALUES(start_time), end_time = VALUES(end_time)`,
            [assignment_id, session_date, period_number, start_time, end_time, req.user.id]
        );

        const sessionId = result.insertId || null;
        // Fetch the actual session id if it was an UPDATE (insertId is 0)
        const [sess] = await db.query(
            'SELECT id FROM attendance_sessions WHERE assignment_id = ? AND session_date = ? AND period_number = ?',
            [assignment_id, session_date, period_number]
        );

        res.status(201).json({ message: 'Session created', session_id: sess[0]?.id });
    } catch (err) {
        console.error('Create session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/sessions?assignment_id=X&date=Y — List sessions
router.get('/sessions', async (req, res) => {
    try {
        const { assignment_id, date } = req.query;
        if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });

        // Verify ownership
        const [assign] = await db.query(
            'SELECT id FROM faculty_assignments WHERE id = ? AND faculty_id = ?',
            [assignment_id, req.user.id]
        );
        if (!assign.length) return res.status(403).json({ error: 'Not your assignment' });

        let sql = 'SELECT * FROM attendance_sessions WHERE assignment_id = ?';
        const params = [assignment_id];
        if (date) { sql += ' AND session_date = ?'; params.push(date); }
        sql += ' ORDER BY session_date, period_number';

        const [sessions] = await db.query(sql, params);
        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/faculty/sessions/:id/cancel — Cancel a session
router.patch('/sessions/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;
        const [sess] = await db.query(
            `SELECT ast.* FROM attendance_sessions ast
             JOIN faculty_assignments fa ON fa.id = ast.assignment_id
             WHERE ast.id = ? AND fa.faculty_id = ?`,
            [req.params.id, req.user.id]
        );
        if (!sess.length) return res.status(404).json({ error: 'Session not found' });

        await db.query(
            "UPDATE attendance_sessions SET status = 'cancelled', cancelled_reason = ? WHERE id = ?",
            [reason || null, req.params.id]
        );
        res.json({ message: 'Session cancelled' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/faculty/sessions/:id/attendance — Submit attendance for a session
// Body: { records: [{ student_id, status }] }
router.post('/sessions/:sessionId/attendance', async (req, res) => {
    try {
        const { records } = req.body;
        const sessionId = req.params.sessionId;

        if (!records || !records.length) {
            return res.status(400).json({ error: 'records required' });
        }

        // Verify faculty owns the session via its assignment
        const [sess] = await db.query(
            `SELECT ast.*, fa.department_id, fa.year, fa.section
             FROM attendance_sessions ast
             JOIN faculty_assignments fa ON fa.id = ast.assignment_id
             WHERE ast.id = ? AND fa.faculty_id = ? AND ast.status = 'conducted'`,
            [sessionId, req.user.id]
        );
        if (!sess.length) return res.status(403).json({ error: 'Session not found or not yours' });

        const session = sess[0];

        // ─── Attendance Window Check (IST) — soft flag only, never block ─
        const windowCheck = await isWithinAttendanceWindow(session.department_id, session.period_number);
        const outsideWindow = !windowCheck.allowed;

        for (const r of records) {
            await db.query(
                `INSERT INTO attendance (student_id, assignment_id, session_id, date, status, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status), edited_at = NOW()`,
                [r.student_id, session.assignment_id, sessionId, session.session_date, r.status, req.user.id]
            );
        }

        // Recalculate attendance_summary for each student
        const studentIds = records.map(r => r.student_id);
        const [ay] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
        const ayId = ay.length ? ay[0].id : null;

        if (ayId) {
            for (const studentId of studentIds) {
                const [stats] = await db.query(`
                    SELECT
                        COUNT(DISTINCT ast.id) AS total_sessions,
                        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended_sessions
                    FROM attendance_sessions ast
                    JOIN attendance a ON a.session_id = ast.id AND a.student_id = ?
                    WHERE ast.assignment_id = ? AND ast.status = 'conducted'
                `, [studentId, session.assignment_id]);

                const total = stats[0].total_sessions || 0;
                const attended = stats[0].attended_sessions || 0;
                const pct = total > 0 ? Math.round((attended / total) * 100 * 100) / 100 : 0;

                await db.query(
                    `INSERT INTO attendance_summary (student_id, assignment_id, academic_year_id, total_sessions, attended_sessions, percentage)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                       total_sessions = VALUES(total_sessions),
                       attended_sessions = VALUES(attended_sessions),
                       percentage = VALUES(percentage)`,
                    [studentId, session.assignment_id, ayId, total, attended, pct]
                );

                // Alert if below threshold
                const [cfg] = await db.query(
                    'SELECT attendance_threshold FROM alert_config WHERE department_id = ? OR department_id IS NULL ORDER BY department_id DESC LIMIT 1',
                    [session.department_id]
                );
                const threshold = cfg.length ? cfg[0].attendance_threshold : 75;

                if (pct < threshold) {
                    const [subj] = await db.query(
                        'SELECT s.name FROM subjects s JOIN faculty_assignments fa ON fa.subject_id = s.id WHERE fa.id = ?',
                        [session.assignment_id]
                    );
                    const subjectName = subj.length ? subj[0].name : 'a subject';

                    const [recent] = await db.query(
                        "SELECT id FROM notifications WHERE user_id = ? AND type = 'alert' AND reference_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)",
                        [studentId, session.assignment_id]
                    );
                    if (!recent.length) {
                        await db.query(
                            'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)',
                            [studentId, 'Attendance Warning', `Your attendance in ${subjectName} is ${pct}%`, 'alert', session.assignment_id]
                        );
                    }
                }
            }
        }

        res.json({
            message: 'Attendance submitted',
            session_id: sessionId,
            outside_window: outsideWindow,
            window_note: outsideWindow ? windowCheck.reason : null
        });
    } catch (err) {
        console.error('Session attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/faculty/active-periods
// Returns class_periods that are currently within the attendance window (IST server time)
router.get('/active-periods', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const [periods] = await db.query(
            'SELECT * FROM class_periods WHERE department_id = ? AND is_active = TRUE ORDER BY period_number',
            [deptId]
        );

        // Current time in IST as HH:MM
        const now = new Date();
        // Convert to IST: UTC+05:30
        const istOffset = 5 * 60 + 30; // minutes
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const istMinutes = (utcMinutes + istOffset) % (24 * 60);
        const nowHH = Math.floor(istMinutes / 60);
        const nowMM = istMinutes % 60;
        const nowTotalMin = nowHH * 60 + nowMM;

        const toMinutes = (timeStr) => {
            // timeStr can be "HH:MM:SS" or "HH:MM"
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const enriched = periods.map(p => {
            const startMin = toMinutes(p.start_time);
            const openMin  = startMin - (p.window_open_before  || 5);
            const closeMin = startMin + (p.window_close_after || 10);
            const isOpen   = nowTotalMin >= openMin && nowTotalMin <= closeMin;
            return {
                ...p,
                start_time:  p.start_time,
                end_time:    p.end_time,
                window_open: `${String(Math.floor(openMin/60)).padStart(2,'0')}:${String(openMin%60).padStart(2,'0')}`,
                window_close:`${String(Math.floor(closeMin/60)).padStart(2,'0')}:${String(closeMin%60).padStart(2,'0')}`,
                is_open:     isOpen,
                current_ist: `${String(nowHH).padStart(2,'0')}:${String(nowMM).padStart(2,'0')}`
            };
        });

        res.json({ periods: enriched });
    } catch (err) {
        console.error('Active periods error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── ATTENDANCE WINDOW ENFORCEMENT ────────────────────────────────────────────
// Helper: check if current IST time is within a period's window
async function isWithinAttendanceWindow(deptId, periodNumber) {
    const [periods] = await db.query(
        'SELECT * FROM class_periods WHERE department_id = ? AND period_number = ? AND is_active = TRUE',
        [deptId, periodNumber]
    );
    if (!periods.length) return { allowed: true, reason: 'No period config — open by default' };

    const p = periods[0];
    const now = new Date();
    const istOffset = 5 * 60 + 30;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMinutes = (utcMinutes + istOffset) % (24 * 60);
    const nowTotalMin = Math.floor(istMinutes);

    const [sh, sm] = p.start_time.split(':').map(Number);
    const startMin  = sh * 60 + sm;
    const openMin   = startMin - (p.window_open_before  || 5);
    const closeMin  = startMin + (p.window_close_after || 10);

    if (nowTotalMin < openMin) {
        const minsLeft = openMin - nowTotalMin;
        return { allowed: false, reason: `Attendance window opens in ${minsLeft} min (${p.window_open_before} min before class start)` };
    }
    if (nowTotalMin > closeMin) {
        return { allowed: false, reason: `Attendance window closed ${nowTotalMin - closeMin} min ago (closes ${p.window_close_after} min after start)` };
    }
    return { allowed: true };
}

// ─── FACULTY PERSONAL TIMETABLE (from HOD-set timetables) ───────────────────
// Reads all hod_timetables across ALL departments and extracts slots
// where facultyId matches this logged-in faculty.
// Result: aggregated day-by-day view of HOD-assigned classes.

// GET /api/faculty/my-schedule
router.get('/my-schedule', async (req, res) => {
    try {
        // 1. Get this faculty user's numeric id and login_id
        const facultyUserId = req.user.id;
        const facultyLoginId = req.user.login_id;

        // 2. Get all distinct (dept, year, section) combos from faculty_assignments
        //    We use this to know WHICH hod_timetables rows to check
        const [assignments] = await db.query(`
            SELECT DISTINCT fa.department_id, fa.year, fa.section,
                            d.name as dept_name
            FROM faculty_assignments fa
            JOIN departments d ON d.id = fa.department_id
            WHERE fa.faculty_id = ?
        `, [facultyUserId]);

        // 3. Also scan ALL hod_timetables (not just assigned sections)
        //    because HOD might add this faculty to sections without a formal assignment
        const [allTimetables] = await db.query(`
            SELECT ht.department_id, ht.year, ht.section, ht.slots_json, d.name as dept_name
            FROM hod_timetables ht
            JOIN departments d ON d.id = ht.department_id
        `);

        const DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        // 4. Parse all JSON blobs and find slots for this faculty
        const scheduleByDay = {};
        DAYS_ORDER.forEach(d => { scheduleByDay[d] = []; });

        for (const tt of allTimetables) {
            let slots;
            try {
                slots = typeof tt.slots_json === 'string' ? JSON.parse(tt.slots_json) : tt.slots_json;
            } catch { continue; }

            if (!slots || typeof slots !== 'object') continue;

            for (const day of DAYS_ORDER) {
                const daySlots = slots[day];
                if (!Array.isArray(daySlots)) continue;

                for (let i = 0; i < daySlots.length; i++) {
                    const slot = daySlots[i];
                    if (!slot || slot.type === 'free') continue;

                    // Match by facultyId (numeric ID stored as string in JSON)
                    const slotFacId = String(slot.facultyId || '');
                    if (slotFacId !== String(facultyUserId)) continue;

                    scheduleByDay[day].push({
                        day,
                        period: slot.period || (i + 1),
                        startTime: slot.startTime || '',
                        endTime: slot.endTime || '',
                        subject: slot.subject || '',
                        subjectId: slot.subjectId || '',
                        type: slot.type || 'class',
                        room: slot.room || '',
                        year: tt.year,
                        section: tt.section,
                        department_id: tt.department_id,
                        dept_name: tt.dept_name,
                    });
                }
            }
        }

        // Sort each day's slots by period number then start time
        DAYS_ORDER.forEach(day => {
            scheduleByDay[day].sort((a, b) =>
                (a.period || 99) - (b.period || 99) ||
                (a.startTime || '').localeCompare(b.startTime || '')
            );
        });

        // Total slot count
        const totalSlots = DAYS_ORDER.reduce((sum, d) => sum + scheduleByDay[d].length, 0);

        // Unique departments and sections
        const sections = [...new Set(allTimetables
            .filter(tt => {
                try {
                    const s = typeof tt.slots_json === 'string' ? JSON.parse(tt.slots_json) : tt.slots_json;
                    return DAYS_ORDER.some(d => (s[d] || []).some(sl => sl && String(sl.facultyId) === String(facultyUserId)));
                } catch { return false; }
            })
            .map(tt => `${tt.dept_name} Y${tt.year} Sec ${tt.section}`)
        )];

        res.json({
            schedule: scheduleByDay,
            total_slots: totalSlots,
            sections_teaching: sections,
            faculty_id: facultyUserId,
        });
    } catch (err) {
        console.error('Faculty my-schedule error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Keep POST and DELETE for any personal overrides (not used in read-only view)
// POST /api/faculty/my-schedule — kept for compatibility
router.post('/my-schedule', async (req, res) => {
    res.status(400).json({ error: 'Faculty timetable is set by HOD. Contact your HOD to update your schedule.' });
});

// DELETE /api/faculty/my-schedule/:slotId — kept for compatibility
router.delete('/my-schedule/:slotId', async (req, res) => {
    res.status(400).json({ error: 'Faculty timetable is set by HOD. Contact your HOD to update your schedule.' });
});

module.exports = router;



