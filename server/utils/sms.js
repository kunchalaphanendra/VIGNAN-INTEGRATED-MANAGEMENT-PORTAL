let twilioClient = null;

function getClient() {
    if (!twilioClient && process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    }
    return twilioClient;
}

async function sendSMS(to, message) {
    try {
        const client = getClient();
        if (!client) {
            console.log(`📱 SMS (mock) to +91${to}: ${message}`);
            return;
        }
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to: `+91${to}`
        });
        console.log(`📱 SMS sent to +91${to}`);
    } catch (err) {
        console.error(`❌ SMS failed to ${to}:`, err.message);
    }
}

async function sendWhatsApp(to, message) {
    try {
        const client = getClient();
        if (!client) {
            console.log(`💬 WhatsApp (mock) to +91${to}: ${message}`);
            return;
        }
        await client.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP}`,
            to: `whatsapp:+91${to}`
        });
        console.log(`💬 WhatsApp sent to +91${to}`);
    } catch (err) {
        console.error(`❌ WhatsApp failed to ${to}:`, err.message);
    }
}

function attendanceWarningMessage(studentName, subjectName, percentage, attended, total) {
    return `⚠️ ATTENDANCE WARNING - Vignan College\n\nDear ${studentName},\nYour attendance in ${subjectName} is ${percentage}% (${attended}/${total}), below the required 75%.\nPlease contact your faculty immediately.\n— Academic Office`;
}

module.exports = { sendSMS, sendWhatsApp, attendanceWarningMessage };
