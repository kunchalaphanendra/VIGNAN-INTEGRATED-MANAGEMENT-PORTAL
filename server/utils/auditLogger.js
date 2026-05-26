const db = require('../db/connection');

/**
 * Reusable utility to log sensitive administrator, faculty, and student actions to the database.
 * 
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - Description tag of the action (e.g. 'PROMOTE_STUDENTS', 'UPDATE_MARKS')
 * @param {string} tableAffected - Name of the DB table affected
 * @param {number|null} recordId - Affected row's primary key ID
 * @param {object} details - Key-value metadata about the changes
 */
async function logAction(userId, action, tableAffected, recordId, details = {}) {
    try {
        if (!userId) return;
        await db.query(
            'INSERT INTO audit_logs (user_id, action, table_affected, record_id, details) VALUES (?, ?, ?, ?, ?)',
            [userId, action, tableAffected, recordId, JSON.stringify(details)]
        );
        console.log(`[Audit] Action logged: User ID ${userId} - ${action} on ${tableAffected} (ID: ${recordId})`);
    } catch (err) {
        console.error('[Audit Logger Error] Failed to write action log:', err.message);
    }
}

module.exports = { logAction };
