const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Accept token from: 1) cookie, 2) Authorization: Bearer header
    // This allows mobile/network access where cookies may not travel through the proxy
    const token = req.cookies?.token
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : null);

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized — no token provided' });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
