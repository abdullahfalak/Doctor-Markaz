
const express = require("express");

module.exports = function createDoctorPaymentRoutes(pool) {
  const router = express.Router();

  const allowedMethods = [
    "easypaisa",
    "jazzcash",
    "bank_transfer",
    "cash",
  ];

  // Get the logged-in doctor's payment methods.
  router.get("/", async (req, res) => {
    try {
      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required.",
        });
      }

      const doctorResult = await pool.query(
        "SELECT id FROM doctors WHERE user_id = $1",
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found.",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      const result = await pool.query(
        `
        SELECT
          id,
          method,
          account_title,
          account_number,
          iban,
          bank_name,
          instructions,
          is_enabled,
          created_at,
          updated_at
        FROM doctor_payment_methods
        WHERE doctor_id = $1
        ORDER BY id ASC
        `,
        [doctorId]
      );

      return res.json({
        success: true,
        payment_methods: result.rows,
      });
    } catch (error) {
      console.error("Get doctor payment methods error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load payment methods.",
      });
    }
  });

  // Add or update one payment method for the logged-in doctor.
  router.put("/", async (req, res) => {
    try {
      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required.",
        });
      }

      const doctorResult = await pool.query(
        "SELECT id FROM doctors WHERE user_id = $1",
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found.",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      const method =
        typeof req.body.method === "string"
          ? req.body.method.trim().toLowerCase()
          : "";

      if (!allowedMethods.includes(method)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment method.",
        });
      }

      const accountTitle =
        typeof req.body.account_title === "string"
          ? req.body.account_title.trim()
          : null;

      const accountNumber =
        typeof req.body.account_number === "string"
          ? req.body.account_number.trim()
          : null;

      const iban =
        typeof req.body.iban === "string"
          ? req.body.iban.trim()
          : null;

      const bankName =
        typeof req.body.bank_name === "string"
          ? req.body.bank_name.trim()
          : null;

      const instructions =
        typeof req.body.instructions === "string"
          ? req.body.instructions.trim()
          : null;

      const isEnabled =
        req.body.is_enabled === undefined
          ? true
          : req.body.is_enabled;

      if (typeof isEnabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "is_enabled must be true or false.",
        });
      }

      // Cash does not require account details.
      if (method !== "cash") {
        if (!accountTitle || !accountNumber) {
          return res.status(400).json({
            success: false,
            message: "Account title and account number are required.",
          });
        }

        if (
          method === "bank_transfer" &&
          !bankName &&
          !iban
        ) {
          return res.status(400).json({
            success: false,
            message: "Bank name or IBAN is required for bank transfer.",
          });
        }
      }

      const result = await pool.query(
        `
        INSERT INTO doctor_payment_methods (
          doctor_id,
          method,
          account_title,
          account_number,
          iban,
          bank_name,
          instructions,
          is_enabled,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)

        ON CONFLICT (doctor_id, method)
        DO UPDATE SET
          account_title = EXCLUDED.account_title,
          account_number = EXCLUDED.account_number,
          iban = EXCLUDED.iban,
          bank_name = EXCLUDED.bank_name,
          instructions = EXCLUDED.instructions,
          is_enabled = EXCLUDED.is_enabled,
          updated_at = CURRENT_TIMESTAMP

        RETURNING
          id,
          method,
          account_title,
          account_number,
          iban,
          bank_name,
          instructions,
          is_enabled,
          updated_at
        `,
        [
          doctorId,
          method,
          accountTitle,
          accountNumber,
          iban,
          bankName,
          instructions,
          isEnabled,
        ]
      );

      return res.json({
        success: true,
        message: "Payment method saved successfully.",
        payment_method: result.rows[0],
      });
    } catch (error) {
      console.error("Save doctor payment method error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to save payment method.",
      });
    }
  });

  return router;
};
