const { authenticator } = require('otplib');
const qrcode = require('qrcode');

/**
 * Generate a new MFA secret for a user
 * @returns {string} The secret
 */
const generateSecret = () => {
  return authenticator.generateSecret();
};

/**
 * Generate a QR code URL for the user to scan
 * @param {string} email - User's email
 * @param {string} secret - MFA secret
 * @returns {Promise<string>} Data URL of the QR code
 */
const generateQRCode = async (email, secret) => {
  const otpauth = authenticator.keyuri(email, 'EduKE', secret);
  return await qrcode.toDataURL(otpauth);
};

/**
 * Verify a TOTP token against a secret
 * @param {string} token - The 6-digit code from the user
 * @param {string} secret - The stored MFA secret
 * @returns {boolean} True if valid
 */
const verifyToken = (token, secret) => {
  return authenticator.verify({ token, secret });
};

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken
};
