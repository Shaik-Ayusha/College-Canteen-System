const crypto = require('crypto');

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to protect pickup OTPs');
  return crypto.createHash('sha256').update(secret).digest();
}

function createPickupOtp() {
  const otp = String(crypto.randomInt(100000, 1000000));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    otp,
    encrypted: [iv, tag, ciphertext].map((part) => part.toString('hex')).join(':'),
  };
}

function decryptPickupOtp(encrypted) {
  const [ivHex, tagHex, ciphertextHex] = String(encrypted || '').split(':');
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error('Stored pickup OTP is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

function otpMatches(provided, actual) {
  if (typeof provided !== 'string' || !/^\d{6}$/.test(provided)) return false;
  const providedBuffer = Buffer.from(provided);
  const actualBuffer = Buffer.from(actual);
  return providedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, actualBuffer);
}

module.exports = { createPickupOtp, decryptPickupOtp, otpMatches };
