const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');
async function check() {
    const [cols] = await db.query("SHOW COLUMNS FROM complaints LIKE 'title'");
    console.log('title column exists:', cols.length > 0 ? 'YES' : 'NO');
    if (cols.length === 0) {
        await db.query('ALTER TABLE complaints ADD COLUMN title VARCHAR(200) NULL');
        console.log('title column ADDED');
    }
    process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
