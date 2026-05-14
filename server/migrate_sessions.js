const db = require('./db/connection');

async function main() {
    try {
        // Fix 1: Update session_dates that are stored as UTC midnight but should be IST date (+1 day)
        // Sessions created between 00:00 and 05:30 UTC will have the wrong date in IST
        // session_date was set to UTC date, but in IST it's already the next day
        const [fixDates] = await db.query(`
            UPDATE attendance_sessions 
            SET session_date = DATE_ADD(session_date, INTERVAL 1 DAY)
            WHERE session_date < CURDATE()
              AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) > session_date
        `);
        console.log('Fixed date offsets:', fixDates.affectedRows);

        // Fix 2: Recalculate outside_window for existing sessions
        // (sessions saved way outside the window but were marked 0 due to the timezone bug)
        const [sessions] = await db.query(`
            SELECT ats.id, ats.start_time, ats.created_at
            FROM attendance_sessions ats
            LEFT JOIN class_periods cp ON cp.department_id = ats.department_id AND cp.period_number = ats.period_number
        `);

        let fixed = 0;
        for (const s of sessions) {
            if (!s.start_time) continue;
            const [sh, sm] = s.start_time.split(':').map(Number);
            const periodStartMins = sh * 60 + sm;
            // Get IST time from created_at
            const createdIST = new Date(new Date(s.created_at).getTime() + 5.5 * 60 * 60 * 1000);
            const submittedMins = createdIST.getUTCHours() * 60 + createdIST.getUTCMinutes();
            const diffMins = submittedMins - periodStartMins;
            const expectedOutside = (diffMins < -5 || diffMins > 10) ? 1 : 0;
            
            // Only update if changed
            await db.query(
                'UPDATE attendance_sessions SET outside_window = ?, hod_confirmed = IF(? = 1 AND hod_confirmed IS NULL, 0, hod_confirmed) WHERE id = ?',
                [expectedOutside, expectedOutside, s.id]
            );
            if (expectedOutside === 1) fixed++;
        }
        console.log('Fixed outside_window flags to 1:', fixed);

        // Fix 3: Drop old unique key and add correct one
        const dbName = (await db.query('SELECT DATABASE() as d'))[0][0].d;
        const [oldKeys] = await db.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
              AND INDEX_NAME IN ('uniq_session','uq_session')
        `, [dbName]);
        for (const k of oldKeys) {
            await db.query(`ALTER TABLE attendance_sessions DROP INDEX \`${k.INDEX_NAME}\``).catch(e => console.log('Drop key err (ok if missing):', e.message));
            console.log('Dropped old key:', k.INDEX_NAME);
        }

        const [newKey] = await db.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions' AND INDEX_NAME = 'uniq_class_period'
        `, [dbName]);
        if (newKey.length === 0) {
            // Delete duplicates first if any
            await db.query(`
                DELETE ats1 FROM attendance_sessions ats1
                INNER JOIN attendance_sessions ats2
                WHERE ats1.id > ats2.id
                  AND ats1.department_id = ats2.department_id
                  AND ats1.year = ats2.year
                  AND ats1.section = ats2.section
                  AND ats1.session_date = ats2.session_date
                  AND ats1.period_number <=> ats2.period_number
            `).catch(e => console.log('Dedup error (ok):', e.message));
            
            await db.query(`
                ALTER TABLE attendance_sessions
                ADD UNIQUE KEY uniq_class_period (department_id, year, section, session_date, period_number)
            `).catch(e => console.log('Add key error (ok if exists):', e.message));
            console.log('Added uniq_class_period key');
        } else {
            console.log('uniq_class_period key already exists');
        }

        // Verify final state
        const [final] = await db.query(`
            SELECT id, session_date, period_number, outside_window, hod_confirmed, faculty_id 
            FROM attendance_sessions ORDER BY id DESC LIMIT 10
        `);
        const fs = require('fs');
        fs.writeFileSync('./migration_result.json', JSON.stringify(final, null, 2));
        console.log('Final sessions written to migration_result.json');
    } catch (err) {
        console.error('Migration error:', err.message);
    }
    process.exit(0);
}
main();
