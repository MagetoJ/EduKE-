const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-default-32-char-secret-key-!!'; // Must be 32 characters

/**
 * Encrypts a string using AES-256-CBC
 * @param {string} text - The text to encrypt
 * @returns {string|null} - Encrypted string in format 'iv:encryptedData'
 */
const encrypt = (text) => {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypts a string using AES-256-CBC
 * @param {string} text - The text to decrypt (format 'iv:encryptedData')
 * @returns {string|null} - Decrypted plain text
 */
const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;

  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    // If decryption fails, it might not be encrypted or key changed
    // Return original text as fallback or log error
    console.error('Decryption error:', error.message);
    return text;
  }
};

module.exports = {
  encrypt,
  decrypt
};
