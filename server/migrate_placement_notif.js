const db = require('./db/connection');
(async () => {
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notifications' AND COLUMN_NAME='type'"
    );
    console.log('type column:', cols[0]?.COLUMN_TYPE);
    // Add 'placement' to ENUM if not present
    const colType = cols[0]?.COLUMN_TYPE || '';
    if (!colType.includes('placement')) {
      await db.query(
        "ALTER TABLE notifications MODIFY COLUMN type ENUM('notice','leave','marks','complaint','alert','poll','calendar','attendance','placement') NOT NULL DEFAULT 'alert'"
      );
      console.log('Added placement to notifications type enum');
    } else {
      console.log('placement already in enum');
    }
  } catch(e) { console.error(e.message); }
  process.exit();
})();
