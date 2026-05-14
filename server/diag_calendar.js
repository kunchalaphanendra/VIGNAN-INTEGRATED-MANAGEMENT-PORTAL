const mysql = require('mysql2/promise');

async function check() {
    const db = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '123456', database: 'vignan_portal'
    });

    // Check the actual column type and how dates are stored
    const [cols] = await db.query(
        "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS " +
        "WHERE TABLE_SCHEMA='vignan_portal' AND TABLE_NAME='academic_calendar' AND COLUMN_NAME='calendar_date'"
    );
    console.log('Column type:');
    console.table(cols);

    // Check what MySQL timezone is set to
    const [tz] = await db.query("SELECT @@global.time_zone, @@session.time_zone, NOW(), CURDATE()");
    console.log('\nMySQL timezone:');
    console.table(tz);

    // Check the actual raw dates for April 2026
    const [dates] = await db.query(
        "SELECT calendar_date, DATE(calendar_date) as date_only, DAYNAME(calendar_date) as dayname_stored, " +
        "DAYNAME(DATE(calendar_date)) as dayname_date, day_type " +
        "FROM academic_calendar " +
        "WHERE MONTH(calendar_date)=4 AND YEAR(calendar_date)=2026 " +
        "LIMIT 10"
    );
    console.log('\nApril 2026 dates vs dayname comparison:');
    console.table(dates);

    await db.end();
}
check().catch(console.error);
