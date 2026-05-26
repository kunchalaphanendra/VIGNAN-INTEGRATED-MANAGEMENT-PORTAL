const bcrypt = require('bcrypt');
const db = require('../db/connection');

module.exports = async (req, res, next) => {
    try {
        const password = req.body.password || req.query.password || req.headers['x-confirm-password'];
        if (!password) {
            return res.status(400).json({ error: 'Password reconfirmation required' });
        }

        const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const match = await bcrypt.compare(password, rows[0].password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Password reconfirmation failed. Access denied.' });
        }

        next();
    } catch (err) {
        console.error('Password reconfirmation middleware error:', err);
        res.status(500).json({ error: 'Internal server error during password verification' });
    }
};
