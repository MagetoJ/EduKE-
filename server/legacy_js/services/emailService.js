const nodemailer = require('nodemailer');
const { FRONTEND_URL } = require('../config');

let transporter = null;

const initializeTransporter = () => {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.warn('Email service not configured. Emails will be logged to console.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter;
};

const sendVerificationEmail = async (to, token) => {
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${token}`;
  const emailTransporter = initializeTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"EduKE Admin" <noreply@eduke.com>',
    to: to,
    subject: 'Verify Your Email - EduKE',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to EduKE!</h2>
        <p>Thank you for registering your school. To activate your account and get started, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #888; font-size: 12px;">If you didn't create an account with EduKE, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    if (!emailTransporter) {
      console.log(`[EMAIL NOT CONFIGURED] Verification email for ${to}:`);
      console.log(`Link: ${verificationLink}`);
      return true;
    }

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error.message);
    return false;
  }
};

const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  const emailTransporter = initializeTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"EduKE Admin" <noreply@eduke.com>',
    to: to,
    subject: 'Reset Your Password - EduKE',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
        <p>To reset your password, click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #888; font-size: 12px;">If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
      </div>
    `,
  };

  try {
    if (!emailTransporter) {
      console.log(`[EMAIL NOT CONFIGURED] Password reset email for ${to}:`);
      console.log(`Link: ${resetLink}`);
      return true;
    }

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
