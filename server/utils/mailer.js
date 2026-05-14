const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

async function sendMail(to, subject, htmlBody) {
    try {
        const t = getTransporter();
        await t.sendMail({
            from: '"Vignan Portal" <noreply@vignan.edu.in>',
            to,
            subject,
            html: htmlBody
        });
        console.log(`📧 Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error(`❌ Email failed to ${to}:`, err.message);
    }
}

function attendanceWarningEmail(studentName, subjectName, percentage, attended, total) {
    return {
        subject: 'Attendance Warning — Vignan College',
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#B71C1C;">⚠️ Attendance Warning</h2>
        <p>Dear <strong>${studentName}</strong>,</p>
        <p>Your attendance in <strong>${subjectName}</strong> has dropped to <strong>${percentage}%</strong>, 
           which is below the minimum required <strong>75%</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:15px 0;">
          <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Classes Attended</strong></td>
              <td style="padding:8px;border:1px solid #ddd;">${attended} / ${total}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Current Percentage</strong></td>
              <td style="padding:8px;border:1px solid #ddd;color:#B71C1C;">${percentage}%</td></tr>
        </table>
        <p>Please contact your faculty immediately.</p>
        <hr/>
        <p style="color:#888;font-size:12px;">— Vignan College Academic Office</p>
      </div>
    `
    };
}

module.exports = { sendMail, attendanceWarningEmail };
