const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  normalizePakistanPhone,
} = require("./guestOtp");

module.exports = function createGuestRoutes(pool) {
  const router = express.Router();

  const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many OTP requests. Please try again later.",
    },
  });

  // Request OTP for guest appointment booking.
  router.post("/request-otp", otpRequestLimiter, async (req, res) => {
    try {
      const phone = normalizePakistanPhone(req.body.phone);

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid Pakistani mobile number.",
        });
      }

      // Do not create a challenge until an SMS provider is configured.
      const smsProviderConfigured =
        process.env.SMS_PROVIDER &&
        process.env.SMS_API_KEY &&
        process.env.SMS_SENDER_ID;

      if (!smsProviderConfigured) {
        return res.status(503).json({
          success: false,
          code: "SMS_PROVIDER_NOT_CONFIGURED",
          message: "SMS verification is temporarily unavailable.",
        });
      }

      // Provider integration will be added after its API details are confirmed.
      return res.status(503).json({
        success: false,
        code: "SMS_PROVIDER_INTEGRATION_PENDING",
        message: "SMS service integration is not completed yet.",
      });
    } catch (error) {
      console.error("Guest OTP request error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to process OTP request.",
      });
    }
  });

  // OTP verification will be implemented after SMS provider integration.
  router.post("/verify-otp", async (req, res) => {
    return res.status(503).json({
      success: false,
      code: "OTP_VERIFICATION_NOT_READY",
      message: "OTP verification is not available yet.",
    });
  });

  // Get enabled payment methods for a doctor.
  router.get("/payment-methods/:doctorId", async (req, res) => {
    try {
      const doctorId = Number(req.params.doctorId);

      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          dpm.id,
          dpm.method,
          dpm.account_title,
          dpm.account_number,
          dpm.iban,
          dpm.bank_name,
          dpm.instructions
        FROM doctor_payment_methods AS dpm
        JOIN doctors AS d
          ON d.id = dpm.doctor_id
        WHERE dpm.doctor_id = $1
          AND dpm.is_enabled = TRUE
          AND d.is_verified = TRUE
        ORDER BY dpm.id ASC
        `,
        [doctorId]
      );

      return res.json({
        success: true,
        payment_methods: result.rows,
      });
    } catch (error) {
      console.error("Guest payment methods error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load payment methods.",
      });
    }
  });

  return router;
};
