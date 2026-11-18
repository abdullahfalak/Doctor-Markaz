
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

const createGuestRoutes = require("./guestRoutes");
const createDoctorPaymentRoutes = require("./doctorPaymentRoutes");

const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: function (req, file, cb) {
    const allowedExtensions = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ]);

    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    const extension = path.extname(file.originalname).toLowerCase();

    if (
      allowedExtensions.has(extension) &&
      allowedMimeTypes.has(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
    }
  },
});

dotenv.config();

const app = express();

app.use("/uploads", express.static(UPLOAD_DIR));


/* =========================
   CORS
========================= */

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   RATE LIMITING
========================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again after 15 minutes.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});

app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);


/* =========================
   DATABASE
========================= */

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.use("/api/guest", createGuestRoutes(pool));

/* =========================
   AUTHENTICATION
========================= */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}
app.use(
  "/api/doctor/payment-methods",
  authenticateToken,
  createDoctorPaymentRoutes(pool)
);

function authenticateAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
}

/* =========================
   BASIC ROUTES
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Doctor Markaz Backend is running!",
  });
});


/* =========================
   DATABASE TEST
========================= */

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Doctor Markaz database connected successfully!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

/* =========================
   PUBLIC SPECIALIZATIONS & AREAS
========================= */

app.get("/api/public/specializations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name
      FROM specializations
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      specializations: result.rows,
    });
  } catch (error) {
    console.error("Public specializations error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to get specializations",
    });
  }
});

app.get("/api/public/areas", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name
      FROM areas
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      areas: result.rows,
    });
  } catch (error) {
    console.error("Public areas error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to get areas",
    });
  }
});

/* =========================
   PUBLIC DOCTORS
========================= */

app.get("/api/doctors", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        doctors.id,
        users.name,
        specializations.name AS specialization,
        areas.name AS area,
        doctors.qualification,
        doctors.experience,
        doctors.consultation_fee,
        doctors.clinic_name,
        doctors.address,
        doctors.bio,
        doctors.profile_image,
        doctors.is_verified
      FROM doctors
      JOIN users
        ON doctors.user_id = users.id
      LEFT JOIN specializations
        ON doctors.specialization_id = specializations.id
      LEFT JOIN areas
        ON doctors.area_id = areas.id
      WHERE doctors.is_verified = TRUE
      ORDER BY doctors.id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      doctors: result.rows,
    });
  } catch (error) {
    console.error("Get doctors error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to get doctors",
      error: error.message,
    });
  }
});

/* =========================
   SEARCH DOCTORS
========================= */

app.get("/api/doctors/search", async (req, res) => {
  try {
    const { area, specialization } = req.query;

    let query = `
      SELECT
        doctors.id,
        users.name,
        specializations.name AS specialization,
        areas.name AS area,
        doctors.qualification,
        doctors.experience,
        doctors.consultation_fee,
        doctors.clinic_name,
        doctors.address,
        doctors.bio,
        doctors.profile_image,
        doctors.is_verified
      FROM doctors
      JOIN users
        ON doctors.user_id = users.id
      LEFT JOIN specializations
        ON doctors.specialization_id = specializations.id
      LEFT JOIN areas
        ON doctors.area_id = areas.id
      WHERE doctors.is_verified = TRUE
    `;

    const values = [];

    if (area) {
      values.push(area);
      query += ` AND areas.name = $${values.length}`;
    }

    if (specialization) {
      values.push(specialization);
      query += ` AND specializations.name = $${values.length}`;
    }

    query += ` ORDER BY doctors.id DESC`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      doctors: result.rows,
    });
  } catch (error) {
    console.error("Search doctors error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to search doctors",
      error: error.message,
    });
  }
});

/* =========================
   SINGLE DOCTOR
========================= */

app.get("/api/doctors/:id", async (req, res) => {
  try {
    const doctorId = req.params.id;

    const result = await pool.query(
      `
      SELECT
        doctors.id,
        users.name,
        specializations.name AS specialization,
        areas.name AS area,
        doctors.qualification,
        doctors.experience,
        doctors.consultation_fee,
        doctors.clinic_name,
        doctors.address,
        doctors.bio,
        doctors.profile_image,
        doctors.is_verified
      FROM doctors
      JOIN users
        ON doctors.user_id = users.id
      LEFT JOIN specializations
        ON doctors.specialization_id = specializations.id
      LEFT JOIN areas
        ON doctors.area_id = areas.id
      WHERE doctors.id = $1
        AND doctors.is_verified = TRUE
      `,
      [doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.json({
      success: true,
      doctor: result.rows[0],
    });
  } catch (error) {
    console.error("Get doctor error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to get doctor",
      error: error.message,
    });
  }
});/* =========================
   PUBLIC DOCTOR REVIEWS
   Returns reviews + average rating
========================= */

app.get("/api/doctors/:id/reviews", async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID.",
      });
    }

    const docCheck = await pool.query(
      `SELECT id FROM doctors WHERE id = $1 AND is_verified = TRUE`,
      [doctorId]
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    const result = await pool.query(
      `SELECT
         r.id,
         r.rating,
         r.comment,
         r.created_at,
         SPLIT_PART(u.name, ' ', 1) AS patient_first_name
       FROM reviews r
       JOIN patients p ON r.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE r.doctor_id = $1
       ORDER BY r.created_at DESC`,
      [doctorId]
    );

    const aggResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_reviews,
         COALESCE(AVG(rating), 0)::numeric(3,1) AS average_rating
       FROM reviews
       WHERE doctor_id = $1`,
      [doctorId]
    );

    const { total_reviews, average_rating } = aggResult.rows[0];

    return res.json({
      success: true,
      total_reviews,
      average_rating: parseFloat(average_rating),
      reviews: result.rows,
    });
  } catch (error) {
    console.error("Get doctor reviews error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to get reviews.",
    });
  }
});

/* =========================
   SUBMIT REVIEW
   Patient reviews a completed appointment
========================= */

app.post(
  "/api/appointments/:appointmentId/review",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "patient") {
        return res.status(403).json({
          success: false,
          message: "Only patients can submit reviews.",
        });
      }

      const appointmentId = Number(req.params.appointmentId);

      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

      const { rating, comment } = req.body;
      const parsedRating = Number(rating);

      if (
        !Number.isInteger(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be a whole number between 1 and 5.",
        });
      }

      if (comment !== undefined && comment !== null) {
        if (typeof comment !== "string") {
          return res.status(400).json({
            success: false,
            message: "Comment must be text.",
          });
        }

        if (comment.trim().length > 1000) {
          return res.status(400).json({
            success: false,
            message: "Comment must be 1000 characters or fewer.",
          });
        }
      }

      const apptResult = await pool.query(
        `SELECT
           a.id,
           a.doctor_id,
           a.status,
           p.id AS patient_id
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.id = $1 AND p.user_id = $2`,
        [appointmentId, req.user.id]
      );

      if (apptResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or does not belong to you.",
        });
      }

      const appointment = apptResult.rows[0];

      if (appointment.status !== "completed") {
        return res.status(400).json({
          success: false,
          message: "You can only review completed appointments.",
        });
      }

      const existingReview = await pool.query(
        `SELECT id FROM reviews WHERE appointment_id = $1`,
        [appointmentId]
      );

      if (existingReview.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted a review for this appointment.",
        });
      }

      const insertResult = await pool.query(
        `INSERT INTO reviews
           (patient_id, doctor_id, appointment_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, patient_id, doctor_id, appointment_id,
                   rating, comment, created_at`,
        [
          appointment.patient_id,
          appointment.doctor_id,
          appointmentId,
          parsedRating,
          comment ? comment.trim() : null,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Review submitted successfully.",
        review: insertResult.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "You have already submitted a review for this appointment.",
        });
      }

      console.error("Submit review error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to submit review.",
      });
    }
  }
);

/* =========================
   GET REVIEW FOR APPOINTMENT
========================= */

app.get(
  "/api/appointments/:appointmentId/review",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "patient") {
        return res.status(403).json({
          success: false,
          message: "Patient access required.",
        });
      }

      const appointmentId = Number(req.params.appointmentId);

      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

      const apptCheck = await pool.query(
        `SELECT a.id
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.id = $1 AND p.user_id = $2`,
        [appointmentId, req.user.id]
      );

      if (apptCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found or does not belong to you.",
        });
      }

      const reviewResult = await pool.query(
        `SELECT id, rating, comment, created_at
         FROM reviews
         WHERE appointment_id = $1`,
        [appointmentId]
      );

      if (reviewResult.rows.length === 0) {
        return res.json({
          success: true,
          reviewed: false,
          review: null,
        });
      }

      return res.json({
        success: true,
        reviewed: true,
        review: reviewResult.rows[0],
      });
    } catch (error) {
      console.error("Get appointment review error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to get review.",
      });
    }
  }
);

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone and password are required",
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE phone = $1
         OR ($2::text IS NOT NULL AND email::text = $2::text)
      `,
      [phone, email || null]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User with this phone or email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users
        (name, email, phone, password, role)
      VALUES
        ($1, $2, $3, $4, 'patient')
      RETURNING id, name, email, phone, role
      `,
      [
        name,
        email || null,
        phone,
        hashedPassword,
      ]
    );

    const user = result.rows[0];

    await pool.query(
      `
      INSERT INTO patients (user_id)
      VALUES ($1)
      `,
      [user.id]
    );

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error.message);

    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      phone,
      password,
    } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        password,
        role
      FROM users
      WHERE phone = $1
      `,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password",
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    delete user.password;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});/* =========================
   CREATE APPOINTMENT
   Validate doctor schedule and prevent duplicate booking
========================= */

app.post(
  "/api/appointments",
  authenticateToken,
  async (req, res) => {
    let client;

    try {
      if (req.user.role !== "patient") {
        return res.status(403).json({
          success: false,
          message: "Only patients can create appointments.",
        });
      }

      const {
        doctor_id,
        appointment_date,
        appointment_time,
        reason,
      } = req.body;

      if (
        !doctor_id ||
        !Number.isInteger(Number(doctor_id)) ||
        Number(doctor_id) <= 0 ||
        !appointment_date ||
        !appointment_time
      ) {
        return res.status(400).json({
          success: false,
          message: "Doctor, date and time are required.",
        });
      }

      // Validate date and time formats.
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
        !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(
          appointment_time
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment date or time format.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");

      // Check patient profile.
      const patientResult = await client.query(
        `SELECT id
         FROM patients
         WHERE user_id = $1`,
        [req.user.id]
      );

      if (patientResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Patient profile not found.",
        });
      }

      const patientId = patientResult.rows[0].id;
      const doctorId = Number(doctor_id);

      // Verify doctor.
      const doctorResult = await client.query(
        `SELECT id
         FROM doctors
         WHERE id = $1
           AND is_verified = TRUE`,
        [doctorId]
      );

      if (doctorResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Verified doctor not found.",
        });
      }

      // Reject impossible calendar dates.
      const [dateYear, dateMonth, dateDay] = appointment_date
        .split("-")
        .map(Number);

      const checkDate = new Date(
        Date.UTC(dateYear, dateMonth - 1, dateDay)
      );

      if (
        checkDate.getUTCFullYear() !== dateYear ||
        checkDate.getUTCMonth() !== dateMonth - 1 ||
        checkDate.getUTCDate() !== dateDay
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Invalid appointment date.",
        });
      }

      // Reject past dates.
      const dateResult = await client.query(
        `SELECT $1::date >= CURRENT_DATE AS is_future_or_today`,
        [appointment_date]
      );

      if (!dateResult.rows[0].is_future_or_today) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Please select today or a future date.",
        });
      }

      // Serialize bookings for the same doctor/date/time.
      await client.query(
        `SELECT pg_advisory_xact_lock(
           $1::integer,
           hashtext($2 || ' ' || $3)
         )`,
        [doctorId, appointment_date, appointment_time]
      );

      // PostgreSQL DOW: Sunday = 0, Monday = 1, ..., Saturday = 6.
      const availabilityResult = await client.query(
        `SELECT id
         FROM doctor_availability
         WHERE doctor_id = $1
           AND day_of_week =
               EXTRACT(DOW FROM $2::date)::integer
           AND is_available = TRUE
           AND start_time <= $3::time
           AND end_time > $3::time
         LIMIT 1`,
        [doctorId, appointment_date, appointment_time]
      );

      if (availabilityResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Doctor is not available on this day or at this time. Please select another slot.",
        });
      }

      // Check whether this slot is already booked.
      const bookedResult = await client.query(
        `SELECT id
         FROM appointments
         WHERE doctor_id = $1
           AND appointment_date = $2::date
           AND appointment_time = $3::time
           AND status IN ('pending', 'confirmed')
         LIMIT 1`,
        [doctorId, appointment_date, appointment_time]
      );

      if (bookedResult.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message:
            "This time slot is already booked. Please select another time.",
        });
      }

      // Create appointment.
      const result = await client.query(
        `INSERT INTO appointments (
           patient_id,
           doctor_id,
           appointment_date,
           appointment_time,
           status,
           reason
         )
         VALUES ($1, $2, $3::date, $4::time, 'pending', $5)
         RETURNING id, patient_id, doctor_id,
                   appointment_date, appointment_time,
                   status, reason, created_at`,
        [
          patientId,
          doctorId,
          appointment_date,
          appointment_time,
          reason || null,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully.",
        appointment: result.rows[0],
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Create appointment error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create appointment.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

/* =========================
   PATIENT APPOINTMENTS
========================= */

app.get(
  "/api/appointments/my",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "patient") {
        return res.status(403).json({
          success: false,
          message: "Patient access required",
        });
      }

      const result = await pool.query(
        `
        SELECT
          appointments.id,
          appointments.doctor_id,
          users.name AS doctor_name,
          specializations.name AS specialization,
          areas.name AS area,
          doctors.clinic_name,
          doctors.address,
          doctors.profile_image,
          doctors.consultation_fee,
          appointments.appointment_date,
          appointments.appointment_time,
          appointments.status,
          appointments.reason,
          appointments.created_at
        FROM appointments
        JOIN patients
          ON appointments.patient_id = patients.id
        JOIN doctors
          ON appointments.doctor_id = doctors.id
        JOIN users
          ON doctors.user_id = users.id
        LEFT JOIN specializations
          ON doctors.specialization_id =
             specializations.id
        LEFT JOIN areas
          ON doctors.area_id = areas.id
        WHERE patients.user_id = $1
        ORDER BY
          appointments.appointment_date DESC,
          appointments.appointment_time DESC
        `,
        [req.user.id]
      );

      res.json({
        success: true,
        appointments: result.rows,
      });
    } catch (error) {
      console.error(
        "My appointments error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get appointments",
        error: error.message,
      });
    }
  }
);

/* =========================
   PATIENT CANCEL APPOINTMENT
   Patient can only cancel their own pending or confirmed appointment
========================= */

app.patch(
  "/api/appointments/:id/cancel",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "patient") {
        return res.status(403).json({
          success: false,
          message: "Only patients can cancel appointments.",
        });
      }

      const appointmentId = req.params.id;

      // Get patient profile.
      const patientResult = await pool.query(
        `SELECT id FROM patients WHERE user_id = $1`,
        [req.user.id]
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Patient profile not found.",
        });
      }

      const patientId = patientResult.rows[0].id;

      // Only allow cancellation of pending or confirmed appointments.
      const result = await pool.query(
        `UPDATE appointments
         SET status = 'cancelled'
         WHERE id = $1
           AND patient_id = $2
           AND status IN ('pending', 'confirmed')
         RETURNING *`,
        [appointmentId, patientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Appointment not found or cannot be cancelled (already completed or cancelled).",
        });
      }

      res.json({
        success: true,
        message: "Appointment cancelled successfully.",
        appointment: result.rows[0],
      });
    } catch (error) {
      console.error("Cancel appointment error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to cancel appointment.",
      });
    }
  }
);


/* =========================
   DOCTOR APPOINTMENTS
========================= */

app.get(
  "/api/doctor/appointments",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required",
        });
      }

      const doctorResult = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      const result = await pool.query(
        `
        SELECT
          appointments.id,
          appointments.patient_id,
          COALESCE(
            users.name,
            appointments.guest_name
          ) AS patient_name,
          COALESCE(
            users.phone,
            appointments.guest_phone
          ) AS patient_phone,
          appointments.guest_name,
          appointments.guest_phone,
          appointments.booking_reference,
          appointments.appointment_date,
          appointments.appointment_time,
          appointments.status,
          appointments.reason,
          appointments.created_at
        FROM appointments
        LEFT JOIN patients
          ON appointments.patient_id = patients.id
        LEFT JOIN users
          ON patients.user_id = users.id
        WHERE appointments.doctor_id = $1
        ORDER BY
          appointments.appointment_date DESC,
          appointments.appointment_time DESC
        `,
        [doctorId]
      );

      res.json({
        success: true,
        appointments: result.rows,
      });
    } catch (error) {
      console.error(
        "Doctor appointments error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get doctor appointments",
        error: error.message,
      });
    }
  }
);


/* =========================
   DOCTOR UPDATE APPOINTMENT STATUS
========================= */

app.patch(
  "/api/doctor/appointments/:id/status",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required",
        });
      }

      const appointmentId = Number(req.params.id);
      const { status } = req.body;

      const allowedStatuses = [
        "confirmed",
        "cancelled",
        "completed",
      ];

      if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment status",
        });
      }

      // Find the logged-in doctor's profile
      const doctorResult = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      // Update only this doctor's appointment
      const result = await pool.query(
        `
        UPDATE appointments
        SET status = $1
        WHERE id = $2
          AND doctor_id = $3
        RETURNING *
        `,
        [status, appointmentId, doctorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found for this doctor",
        });
      }

      return res.json({
        success: true,
        message: "Appointment status updated successfully",
        appointment: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Update appointment status error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update appointment",
      });
    }
  }
);

;/* =========================
   ADMIN STATS
========================= */

app.get(
  "/api/admin/stats",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const doctorsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM doctors
      `);

      const verifiedDoctorsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM doctors
        WHERE is_verified = TRUE
      `);

      const patientsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE role = 'patient'
      `);

      const appointmentsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM appointments
      `);

      const pendingAppointmentsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM appointments
        WHERE status = 'pending'
      `);

      const confirmedAppointmentsResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM appointments
        WHERE status = 'confirmed'
      `);

      res.json({
        success: true,
        stats: {
          total_doctors: doctorsResult.rows[0].count,
          verified_doctors: verifiedDoctorsResult.rows[0].count,
          total_patients: patientsResult.rows[0].count,
          total_appointments: appointmentsResult.rows[0].count,
          pending_appointments: pendingAppointmentsResult.rows[0].count,
          confirmed_appointments: confirmedAppointmentsResult.rows[0].count,
        },
      });
    } catch (error) {
      console.error("Admin stats error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to get admin statistics",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN DOCTORS
========================= */

app.get(
  "/api/admin/doctors",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          doctors.id,
          users.name,
          users.email,
          users.phone,
          specializations.name AS specialization,
          doctors.specialization_id,
          areas.name AS area,
          doctors.area_id,
          doctors.qualification,
          doctors.experience,
          doctors.consultation_fee,
          doctors.clinic_name,
          doctors.address,
          doctors.bio,
          doctors.profile_image,
          doctors.is_verified
        FROM doctors
        JOIN users
          ON doctors.user_id = users.id
        LEFT JOIN specializations
          ON doctors.specialization_id = specializations.id
        LEFT JOIN areas
          ON doctors.area_id = areas.id
        ORDER BY doctors.id DESC
      `);

      res.json({
        success: true,
        doctors: result.rows,
      });
    } catch (error) {
      console.error("Admin doctors error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to get doctors",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN ADD DOCTOR
========================= */

app.post(
  "/api/admin/doctors",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        name,
        email,
        phone,
        password,
        specialization_id,
        area_id,
        qualification,
        experience,
        consultation_fee,
        clinic_name,
        address,
        bio,
        profile_image,
        is_verified,
      } = req.body;

      if (
        !name ||
        !phone ||
        !password ||
        !specialization_id ||
        !area_id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, phone, password, specialization and area are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters long",
        });
      }

      const specializationResult = await client.query(
        `
        SELECT id
        FROM specializations
        WHERE id = $1
        `,
        [specialization_id]
      );

      if (specializationResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid specialization",
        });
      }

      const areaResult = await client.query(
        `
        SELECT id
        FROM areas
        WHERE id = $1
        `,
        [area_id]
      );

      if (areaResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid area",
        });
      }

      const existingUser = await client.query(
        `
        SELECT id
        FROM users
        WHERE phone = $1
           OR (
             $2::text IS NOT NULL
             AND email::text = $2::text
           )
        `,
        [phone, email || null]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "User with this phone or email already exists",
        });
      }

      const doctorExperience =
        experience === undefined ||
        experience === null ||
        experience === ""
          ? 0
          : Number(experience);

      if (
        !Number.isInteger(doctorExperience) ||
        doctorExperience < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Experience must be a valid number",
        });
      }

      const doctorFee =
        consultation_fee === undefined ||
        consultation_fee === null ||
        consultation_fee === ""
          ? 0
          : Number(consultation_fee);

      if (
        !Number.isFinite(doctorFee) ||
        doctorFee < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Consultation fee must be a valid number",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await client.query("BEGIN");

      const userResult = await client.query(
        `
        INSERT INTO users
          (name, email, phone, password, role)
        VALUES
          ($1, $2, $3, $4, 'doctor')
        RETURNING id, name, email, phone, role
        `,
        [
          name,
          email || null,
          phone,
          hashedPassword,
        ]
      );

      const user = userResult.rows[0];

      const doctorResult = await client.query(
        `
        INSERT INTO doctors
          (
            user_id,
            specialization_id,
            area_id,
            qualification,
            experience,
            consultation_fee,
            clinic_name,
            address,
            bio,
            profile_image,
            is_verified
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        `,
        [
          user.id,
          specialization_id,
          area_id,
          qualification || null,
          doctorExperience,
          doctorFee,
          clinic_name || null,
          address || null,
          bio || null,
          profile_image || null,
          is_verified === true,
        ]
      );

      const doctor = doctorResult.rows[0];

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Doctor added successfully",
        doctor: {
          id: doctor.id,
          user_id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          specialization_id: doctor.specialization_id,
          area_id: doctor.area_id,
          qualification: doctor.qualification,
          experience: doctor.experience,
          consultation_fee: doctor.consultation_fee,
          clinic_name: doctor.clinic_name,
          address: doctor.address,
          bio: doctor.bio,
          profile_image: doctor.profile_image,
          is_verified: doctor.is_verified,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Admin add doctor error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to add doctor",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }
);/* =========================
   ADMIN EDIT DOCTOR
========================= */

app.put(
  "/api/admin/doctors/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const doctorId = Number(req.params.id);

      const {
        name,
        email,
        phone,
        specialization_id,
        area_id,
        qualification,
        experience,
        consultation_fee,
        clinic_name,
        address,
        bio,
        profile_image,
      } = req.body;

      if (
        !Number.isInteger(doctorId) ||
        doctorId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID",
        });
      }

      if (
        !name?.trim() ||
        !phone?.trim() ||
        !specialization_id ||
        !area_id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, phone, specialization and area are required",
        });
      }

      const doctorResult = await client.query(
        `
        SELECT id, user_id
        FROM doctors
        WHERE id = $1
        `,
        [doctorId]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }

      const doctorUserId = doctorResult.rows[0].user_id;

      const specializationResult = await client.query(
        `SELECT id FROM specializations WHERE id = $1`,
        [specialization_id]
      );

      if (specializationResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid specialization",
        });
      }

      const areaResult = await client.query(
        `SELECT id FROM areas WHERE id = $1`,
        [area_id]
      );

      if (areaResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid area",
        });
      }

      const existingUser = await client.query(
        `
        SELECT id
        FROM users
        WHERE id <> $1
          AND (
            phone = $2
            OR (
              $3::text IS NOT NULL
              AND email = $3
            )
          )
        `,
        [
          doctorUserId,
          phone.trim(),
          email?.trim() || null,
        ]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This phone number or email is already in use",
        });
      }

      const doctorExperience =
        experience === "" ||
        experience === undefined ||
        experience === null
          ? 0
          : Number(experience);

      if (
        !Number.isInteger(doctorExperience) ||
        doctorExperience < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Experience must be a non-negative whole number",
        });
      }

      const doctorFee =
        consultation_fee === "" ||
        consultation_fee === undefined ||
        consultation_fee === null
          ? 0
          : Number(consultation_fee);

      if (
        !Number.isFinite(doctorFee) ||
        doctorFee < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Consultation fee must be a valid non-negative number",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      await client.query(
        `
        UPDATE users
        SET
          name = $1,
          phone = $2,
          email = $3
        WHERE id = $4
        `,
        [
          name.trim(),
          phone.trim(),
          email?.trim() || null,
          doctorUserId,
        ]
      );

      const updatedDoctor = await client.query(
        `
        UPDATE doctors
        SET
          specialization_id = $1,
          area_id = $2,
          qualification = $3,
          experience = $4,
          consultation_fee = $5,
          clinic_name = $6,
          address = $7,
          bio = $8,
          profile_image = $9
        WHERE id = $10
        RETURNING *
        `,
        [
          Number(specialization_id),
          Number(area_id),
          qualification?.trim() || null,
          doctorExperience,
          doctorFee,
          clinic_name?.trim() || null,
          address?.trim() || null,
          bio?.trim() || null,
          profile_image?.trim() || null,
          doctorId,
        ]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Doctor updated successfully",
        doctor: updatedDoctor.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Admin edit doctor error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update doctor",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================
   ADMIN VERIFY DOCTOR
========================= */

app.patch(
  "/api/admin/doctors/:id/verify",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE doctors
        SET is_verified = TRUE
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        message: "Doctor verified successfully",
        doctor: result.rows[0],
      });
    } catch (error) {
      console.error("Verify doctor error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to verify doctor",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN UNVERIFY DOCTOR
========================= */

app.patch(
  "/api/admin/doctors/:id/unverify",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE doctors
        SET is_verified = FALSE
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }

      res.json({
        success: true,
        message: "Doctor verification removed",
        doctor: result.rows[0],
      });
    } catch (error) {
      console.error("Unverify doctor error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to unverify doctor",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN DEACTIVATE DOCTOR
   Preserves all records
========================= */

app.patch(
  "/api/admin/doctors/:id/deactivate",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const doctorId = Number(req.params.id);

      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID.",
        });
      }

      const result = await pool.query(
        `UPDATE doctors
         SET is_verified = FALSE
         WHERE id = $1
         RETURNING id, is_verified`,
        [doctorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Doctor deactivated. They are now hidden from public listings. " +
          "All appointment history and records are preserved.",
        doctor: result.rows[0],
      });
    } catch (error) {
      console.error("Deactivate doctor error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to deactivate doctor.",
      });
    }
  }
);

/* =========================
   ADMIN DELETE DOCTOR
   Only allowed when doctor has no appointments or reviews
========================= */

app.delete(
  "/api/admin/doctors/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const doctorId = Number(req.params.id);

      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID.",
        });
      }

      const doctorCheck = await client.query(
        `SELECT d.id, d.user_id, u.name
         FROM doctors d
         JOIN users u ON d.user_id = u.id
         WHERE d.id = $1`,
        [doctorId]
      );

      if (doctorCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found.",
        });
      }

      const {
        user_id: userId,
        name: doctorName,
      } = doctorCheck.rows[0];

      const apptCount = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM appointments
         WHERE doctor_id = $1`,
        [doctorId]
      );

      const totalAppointments = apptCount.rows[0].count;

      if (totalAppointments > 0) {
        return res.status(409).json({
          success: false,
          message:
            `"${doctorName}" has ${totalAppointments} appointment record` +
            `${totalAppointments !== 1 ? "s" : ""} and cannot be permanently deleted. ` +
            `Use Deactivate to hide this doctor from public listings while preserving all records.`,
          appointment_count: totalAppointments,
        });
      }

      const reviewCount = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM reviews
         WHERE doctor_id = $1`,
        [doctorId]
      );

      const totalReviews = reviewCount.rows[0].count;

      if (totalReviews > 0) {
        return res.status(409).json({
          success: false,
          message:
            `"${doctorName}" has ${totalReviews} review record` +
            `${totalReviews !== 1 ? "s" : ""} and cannot be permanently deleted.`,
          review_count: totalReviews,
        });
      }

      await client.query("BEGIN");

      await client.query(
        `DELETE FROM doctor_availability WHERE doctor_id = $1`,
        [doctorId]
      );

      await client.query(
        `DELETE FROM doctors WHERE id = $1`,
        [doctorId]
      );

      await client.query(
        `DELETE FROM users WHERE id = $1`,
        [userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: `Doctor "${doctorName}" has been permanently deleted.`,
        deleted_doctor_id: doctorId,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Delete doctor error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to delete doctor.",
      });
    } finally {
      client.release();
    }
  }
);/* =========================
   ADMIN PATIENTS
========================= */

app.get(
  "/api/admin/patients",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          patients.id,
          patients.id AS patient_id,
          users.id AS user_id,
          users.name,
          users.email,
          users.phone,
          patients.date_of_birth,
          patients.gender,
          patients.address,
          patients.created_at
        FROM patients
        JOIN users
          ON patients.user_id = users.id
        ORDER BY patients.id DESC
      `);

      res.json({
        success: true,
        patients: result.rows,
      });
    } catch (error) {
      console.error("Admin patients error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to get patients",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN APPOINTMENTS
========================= */

app.get(
  "/api/admin/appointments",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          appointments.id,
          appointments.patient_id,
          appointments.doctor_id,
          patient_users.name AS patient_name,
          patient_users.phone AS patient_phone,
          doctor_users.name AS doctor_name,
          appointments.appointment_date,
          appointments.appointment_time,
          appointments.status,
          appointments.reason,
          appointments.created_at
        FROM appointments
        JOIN patients
          ON appointments.patient_id = patients.id
        JOIN users AS patient_users
          ON patients.user_id = patient_users.id
        JOIN doctors
          ON appointments.doctor_id = doctors.id
        JOIN users AS doctor_users
          ON doctors.user_id = doctor_users.id
        ORDER BY
          appointments.appointment_date DESC,
          appointments.appointment_time DESC
      `);

      res.json({
        success: true,
        appointments: result.rows,
      });
    } catch (error) {
      console.error("Admin appointments error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to get appointments",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN UPDATE APPOINTMENT
========================= */

app.patch(
  "/api/admin/appointments/:id/status",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment status",
        });
      }

      const result = await pool.query(
        `
        UPDATE appointments
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
        [status, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      res.json({
        success: true,
        message: "Appointment status updated",
        appointment: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Admin appointment status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to update appointment",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN SPECIALIZATIONS
========================= */

app.get(
  "/api/admin/specializations",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM specializations
        ORDER BY name ASC
      `);

      res.json({
        success: true,
        specializations: result.rows,
      });
    } catch (error) {
      console.error(
        "Admin specializations error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get specializations",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN AREAS
========================= */

app.get(
  "/api/admin/areas",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM areas
        ORDER BY name ASC
      `);

      res.json({
        success: true,
        areas: result.rows,
      });
    } catch (error) {
      console.error("Admin areas error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to get areas",
        error: error.message,
      });
    }
  }
);

/* =========================
   ADMIN ADD SPECIALIZATION
========================= */

app.post(
  "/api/admin/specializations",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Specialization name is required.",
        });
      }

      const trimmed = name.trim();

      const result = await pool.query(
        `INSERT INTO specializations (name)
         VALUES ($1)
         RETURNING id, name, created_at`,
        [trimmed]
      );

      return res.status(201).json({
        success: true,
        message: "Specialization added successfully.",
        specialization: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A specialization with this name already exists.",
        });
      }

      console.error("Add specialization error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to add specialization.",
      });
    }
  }
);

/* =========================
   ADMIN EDIT SPECIALIZATION
========================= */

app.put(
  "/api/admin/specializations/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const specId = Number(req.params.id);
      const { name } = req.body;

      if (!Number.isInteger(specId) || specId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid specialization ID.",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Specialization name is required.",
        });
      }

      const trimmed = name.trim();

      const result = await pool.query(
        `UPDATE specializations
         SET name = $1
         WHERE id = $2
         RETURNING id, name, created_at`,
        [trimmed, specId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Specialization not found.",
        });
      }

      return res.json({
        success: true,
        message: "Specialization updated successfully.",
        specialization: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A specialization with this name already exists.",
        });
      }

      console.error("Edit specialization error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to update specialization.",
      });
    }
  }
);

/* =========================
   ADMIN DELETE SPECIALIZATION
   Blocked if any doctor uses it
========================= */

app.delete(
  "/api/admin/specializations/:id",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const specId = Number(req.params.id);

      if (!Number.isInteger(specId) || specId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid specialization ID.",
        });
      }

      const usageCheck = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM doctors
         WHERE specialization_id = $1`,
        [specId]
      );

      const count = usageCheck.rows[0].count;

      if (count > 0) {
        return res.status(409).json({
          success: false,
          message:
            `Cannot delete — ${count} doctor${count !== 1 ? "s are" : " is"} using this specialization.`,
        });
      }

      const result = await pool.query(
        `DELETE FROM specializations
         WHERE id = $1
         RETURNING id, name`,
        [specId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Specialization not found.",
        });
      }

      return res.json({
        success: true,
        message:
          `Specialization "${result.rows[0].name}" deleted successfully.`,
      });
    } catch (error) {
      console.error("Delete specialization error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to delete specialization.",
      });
    }
  }
);

/* =========================
   ADMIN ADD AREA
========================= */

app.post(
  "/api/admin/areas",
  authenticateToken,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Area name is required.",
        });
      }

      const trimmed = name.trim();

      const result = await pool.query(
        `INSERT INTO areas (name)
         VALUES ($1)
         RETURNING id, name, created_at`,
        [trimmed]
      );

      return res.status(201).json({
        success: true,
        message: "Area added successfully.",
        area: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An area with this name already exists.",
        });
      }

      console.error("Add area error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to add area.",
      });
    }
  }
);/* =========================
   DOCTOR AVAILABILITY
========================= */

/*
  day_of_week:
  0 = Sunday
  1 = Monday
  2 = Tuesday
  3 = Wednesday
  4 = Thursday
  5 = Friday
  6 = Saturday
*/


/* =========================
   GET DOCTOR AVAILABILITY
   Doctor apna schedule dekh sakta hai
========================= */

app.get(
  "/api/doctor/availability",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required",
        });
      }

      const doctorResult = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      const result = await pool.query(
        `
        SELECT
          id,
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          is_available
        FROM doctor_availability
        WHERE doctor_id = $1
        ORDER BY day_of_week ASC, start_time ASC
        `,
        [doctorId]
      );

      res.json({
        success: true,
        availability: result.rows,
      });
    } catch (error) {
      console.error(
        "Get doctor availability error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get doctor availability",
        error: error.message,
      });
    }
  }
);


/* =========================
   SAVE / UPDATE DOCTOR AVAILABILITY
========================= */

app.put(
  "/api/doctor/availability",
  authenticateToken,
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      if (req.user.role !== "doctor") {
        return res.status(403).json({
          success: false,
          message: "Doctor access required",
        });
      }

      const { availability } = req.body;

      if (!Array.isArray(availability)) {
        return res.status(400).json({
          success: false,
          message: "Availability must be an array",
        });
      }

      const doctorResult = await client.query(
        `
        SELECT id
        FROM doctors
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor profile not found",
        });
      }

      const doctorId = doctorResult.rows[0].id;

      /*
        Validate all schedule entries
      */

      for (const item of availability) {
        const {
          day_of_week,
          start_time,
          end_time,
          is_available,
        } = item;

        if (
          day_of_week === undefined ||
          start_time === undefined ||
          end_time === undefined
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Day, start time and end time are required",
          });
        }

        const day = Number(day_of_week);

        if (
          !Number.isInteger(day) ||
          day < 0 ||
          day > 6
        ) {
          return res.status(400).json({
            success: false,
            message:
              "day_of_week must be between 0 and 6",
          });
        }

        if (start_time >= end_time) {
          return res.status(400).json({
            success: false,
            message:
              "End time must be later than start time",
          });
        }

        if (typeof is_available !== "boolean") {
          return res.status(400).json({
            success: false,
            message:
              "is_available must be true or false",
          });
        }
      }

      await client.query("BEGIN");
      transactionStarted = true;

      /*
        Delete old schedule
        and replace it with new schedule
      */

      await client.query(
        `
        DELETE FROM doctor_availability
        WHERE doctor_id = $1
        `,
        [doctorId]
      );

      /*
        Insert new schedule
      */

      for (const item of availability) {
        await client.query(
          `
          INSERT INTO doctor_availability
          (
            doctor_id,
            day_of_week,
            start_time,
            end_time,
            is_available
          )
          VALUES
          ($1, $2, $3, $4, $5)
          `,
          [
            doctorId,
            Number(item.day_of_week),
            item.start_time,
            item.end_time,
            item.is_available,
          ]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      const result = await pool.query(
        `
        SELECT
          id,
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          is_available
        FROM doctor_availability
        WHERE doctor_id = $1
        ORDER BY day_of_week ASC, start_time ASC
        `,
        [doctorId]
      );

      res.json({
        success: true,
        message:
          "Doctor availability saved successfully",
        availability: result.rows,
      });
    } catch (error) {
      if (client && transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error(
        "Save doctor availability error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to save doctor availability",
        error: error.message,
      });
    } finally {
      if (client) client.release();
    }
  }
);

/* =========================
   PUBLIC DOCTOR AVAILABILITY
   Patients selected doctor ka
   weekly schedule dekh sakte hain
========================= */

app.get(
  "/api/doctors/:id/availability",
  async (req, res) => {
    try {
      const doctorId = Number(req.params.id);

      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID.",
        });
      }

      // Only verified doctors can be viewed publicly
      const doctorResult = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE id = $1
          AND is_verified = TRUE
        `,
        [doctorId]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found.",
        });
      }

      // Get this doctor's own available schedule
      const result = await pool.query(
        `
        SELECT
          id,
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          is_available
        FROM doctor_availability
        WHERE doctor_id = $1
          AND is_available = TRUE
        ORDER BY day_of_week ASC, start_time ASC
        `,
        [doctorId]
      );

      return res.json({
        success: true,
        availability: result.rows,
      });
    } catch (error) {
      console.error(
        "Public doctor availability error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Failed to get doctor availability.",
      });
    }
  }
);


/* =========================
   PUBLIC BOOKED SLOTS
   Patients already booked
   time slots dekh sakte hain
========================= */

app.get(
  "/api/doctors/:id/booked-slots",
  async (req, res) => {
    try {
      const doctorId = req.params.id;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "Appointment date is required.",
        });
      }

      // Validate date
      const dateCheck = await pool.query(
        `
        SELECT $1::date AS appointment_date
        `,
        [date]
      );

      const appointmentDate =
        dateCheck.rows[0]?.appointment_date;

      if (!appointmentDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment date.",
        });
      }

      // Check verified doctor
      const doctorResult = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE id = $1
          AND is_verified = TRUE
        `,
        [doctorId]
      );

      if (doctorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Doctor not found.",
        });
      }

      // Get already booked active slots
      const result = await pool.query(
        `
        SELECT
          TO_CHAR(appointment_time, 'HH24:MI') AS appointment_time
        FROM appointments
        WHERE doctor_id = $1
          AND appointment_date = $2::date
          AND status IN ('pending', 'confirmed')
        ORDER BY appointment_time ASC
        `,
        [doctorId, appointmentDate]
      );

      res.json({
        success: true,
        date: appointmentDate,
        booked_slots: result.rows.map(
          (row) => row.appointment_time
        ),
      });
    } catch (error) {
      console.error(
        "Booked slots error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get booked slots.",
      });
    }
  }
);/* =========================
   ADMIN IMAGE UPLOAD
========================= */

app.post(
  "/api/admin/upload-image",
  authenticateToken,
  authenticateAdmin,
  upload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image.",
        });
      }

      const imageUrl = `/uploads/${req.file.filename}`;

      res.json({
        success: true,
        message: "Image uploaded successfully.",
        imageUrl,
      });
    } catch (error) {
      console.error(
        "Image upload error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Image upload failed.",
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Doctor Markaz Backend running on http://localhost:${PORT}`
  );
});