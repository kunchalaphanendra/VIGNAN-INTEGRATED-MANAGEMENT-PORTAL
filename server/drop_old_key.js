const db = require('./db/connection');
async function main() {
    try {
        await db.query('SET FOREIGN_KEY_CHECKS=0');
        await db.query('ALTER TABLE attendance_sessions DROP INDEX uq_session').catch(e => console.log('Drop uq_session:', e.message));
        await db.query('ALTER TABLE attendance_sessions DROP INDEX uniq_session').catch(e => console.log('Drop uniq_session:', e.message));
        await db.query('SET FOREIGN_KEY_CHECKS=1');

        // Verify final indexes
        const dbName = (await db.query('SELECT DATABASE() as d'))[0][0].d;
        const [idx] = await db.query(
            `SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
             ORDER BY INDEX_NAME, SEQ_IN_INDEX`, [dbName]
        );
        console.log('Final indexes:');
        idx.forEach(r => console.log(` ${r.INDEX_NAME}: ${r.COLUMN_NAME}`));
    } catch(e) { console.log('Error:', e.message); }
    process.exit(0);
}
main();
