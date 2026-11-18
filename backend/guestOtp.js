const crypto = require("crypto");

function getOtpSecret() {
  const secret = process.env.OTP_HMAC_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error("OTP_HMAC_SECRET is missing or invalid.");
  }

  return secret;
}

// Generate a cryptographically secure 6-digit OTP.
function generateOtp() {
  return crypto.randomInt(0, 1000000)
    .toString()
    .padStart(6, "0");
}

// Store an HMAC hash instead of the plain OTP.
function hashOtp(phone, challengeId, otp) {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${challengeId}:${phone}:${otp}`)
    .digest("hex");
}

// Compare OTP hashes safely.
function verifyOtp(phone, challengeId, otp, storedHash) {
  if (!/^\d{6}$/.test(String(otp))) {
    return false;
  }

  if (
    typeof storedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  const expectedHash = Buffer.from(
    hashOtp(phone, challengeId, otp),
    "hex"
  );

  const actualHash = Buffer.from(storedHash, "hex");

  return crypto.timingSafeEqual(expectedHash, actualHash);
}

// Normalize Pakistani mobile numbers.
function normalizePakistanPhone(input) {
  if (typeof input !== "string") {
    return null;
  }

  let phone = input.replace(/[\s()-]/g, "");

  if (/^03\d{9}$/.test(phone)) {
    phone = "+92" + phone.slice(1);
  } else if (/^923\d{9}$/.test(phone)) {
    phone = "+" + phone;
  }

  if (!/^\+923\d{9}$/.test(phone)) {
    return null;
  }

  return phone;
}

// Generate a non-sequential booking reference.
function generateBookingReference() {
  return "DM-" +
    crypto.randomBytes(8).toString("hex").toUpperCase();
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  normalizePakistanPhone,
  generateBookingReference,
};
