// reset_principal.js — Run once to reset principal password
// Usage: node reset_principal.js
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');
const db = require('./db/connection');

const NEW_PASSWORD = 'Principal@123';

async function main() {
    try {
        const hash = await bcrypt.hash(NEW_PASSWORD, 12);
        const [result] = await db.query(
            "UPDATE users SET password_hash = ? WHERE login_id = 'PRINCIPAL01' AND role = 'principal'",
            [hash]
        );
        if (result.affectedRows > 0) {
            console.log('✅ Principal password reset successfully!');
            console.log('   Login ID : PRINCIPAL01');
            console.log('   Password : Principal@123');
        } else {
            console.log('❌ No principal account found with login_id = PRINCIPAL01');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

main();
