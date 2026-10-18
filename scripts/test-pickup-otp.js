const assert = require('assert');

process.env.JWT_SECRET = 'pickup-otp-test-secret';
const { createPickupOtp, decryptPickupOtp, otpMatches } = require('../src/services/pickupOtp');

const first = createPickupOtp();
const second = createPickupOtp();

assert.match(first.otp, /^\d{6}$/);
assert.strictEqual(decryptPickupOtp(first.encrypted), first.otp);
assert.notStrictEqual(first.encrypted, first.otp);
assert.strictEqual(otpMatches(first.otp, first.otp), true);
assert.strictEqual(otpMatches(second.otp, first.otp), false);
assert.strictEqual(otpMatches('12345', first.otp), false);

console.log('All pickup OTP tests passed');
