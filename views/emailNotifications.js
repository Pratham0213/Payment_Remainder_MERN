// emailNotifications.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

async function sendEmailNotification(reminder) {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: reminder.userEmail,
        subject: 'Payment Reminder',
        text: `Dear ${reminder.userName},\n\nThis is a reminder that your payment for ${reminder.name} is due on ${reminder.dueDate}.\n\nThank you.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Error sending email notification:', error);
    }
}

module.exports = { sendEmailNotification };
