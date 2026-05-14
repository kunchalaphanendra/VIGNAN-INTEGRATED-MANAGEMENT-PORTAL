const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function check() {
    try {
        const [rows] = await db.query(
            'SELECT id, complaint_ref, portal_type, status, submitted_at FROM complaints ORDER BY submitted_at DESC LIMIT 5'
        );
        console.log('Recent complaints:');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
check();
