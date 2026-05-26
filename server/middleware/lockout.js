const db = require('../db/connection');

const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

async function checkLockout(req, res, next) {
    const { login_id } = req.body;
    if (!login_id) return next();

    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) as failed_count FROM login_attempts 
             WHERE login_id = ? 
             AND attempted_at >= NOW() - INTERVAL ? MINUTE 
             AND is_failed = TRUE`,
            [login_id, LOCKOUT_WINDOW_MINUTES]
        );

        const failedCount = rows[0]?.failed_count || 0;
        if (failedCount >= MAX_ATTEMPTS) {
            const [lastAttempt] = await db.query(
                `SELECT attempted_at FROM login_attempts 
                 WHERE login_id = ? AND is_failed = TRUE 
                 ORDER BY attempted_at DESC LIMIT 1`,
                [login_id]
            );
            
            let minutesLeft = LOCKOUT_WINDOW_MINUTES;
            if (lastAttempt.length > 0) {
                const elapsedMs = Date.now() - new Date(lastAttempt[0].attempted_at).getTime();
                const elapsedMin = elapsedMs / (60 * 1000);
                minutesLeft = Math.max(1, Math.ceil(LOCKOUT_WINDOW_MINUTES - elapsedMin));
            }

            return res.status(423).json({ 
                error: `Account locked due to too many failed login attempts. Please try again in ${minutesLeft} minutes.` 
            });
        }
        next();
    } catch (err) {
        console.error('[Lockout Middleware Error]:', err);
        next();
    }
}

async function recordAttempt(loginId, ipAddress, isFailed) {
    try {
        await db.query(
            `INSERT INTO login_attempts (login_id, ip_address, is_failed) VALUES (?, ?, ?)`,
            [loginId, ipAddress || 'unknown', isFailed]
        );
        
        if (!isFailed) {
            await db.query(
                `DELETE FROM login_attempts WHERE login_id = ? AND is_failed = TRUE`,
                [loginId]
            );
        }
    } catch (err) {
        console.error('[Lockout Record Error]:', err.message);
    }
}

module.exports = { checkLockout, recordAttempt };
