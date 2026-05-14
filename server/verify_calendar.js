const mysql = require('mysql2/promise');
mysql.createConnection({host:'localhost',user:'root',password:'123456',database:'vignan_portal'})
.then(async db => {
  const [rows] = await db.query(
    'SELECT DAYNAME(calendar_date) AS day_name, CEIL(DAY(calendar_date)/7) AS week_num, day_type, COUNT(*) AS cnt ' +
    'FROM academic_calendar WHERE DAYNAME(calendar_date) IN (\'Sunday\',\'Saturday\') ' +
    'GROUP BY DAYNAME(calendar_date), CEIL(DAY(calendar_date)/7), day_type ' +
    'ORDER BY day_name, week_num, day_type'
  );
  console.table(rows);
  await db.end();
}).catch(console.error);
