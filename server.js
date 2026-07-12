const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const rateLimit = require("express-rate-limit");
// Load environment variables early so other modules can read them
dotenv.config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const aiRoutes = require("./routes/aiRoutes");
const resumeParserRoutes = require("./routes/resumeParserRoutes");

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: "Too many AI requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const parserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { message: "Too many file parsing requests. Limit is 10 per hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Basic env validation
const missingCritical = [];
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  missingCritical.push("DB_HOST/DB_USER/DB_NAME");
}
if (!process.env.JWT_SECRET) missingCritical.push("JWT_SECRET");
if (missingCritical.length > 0) {
  console.error(
    "Missing critical environment variables:",
    missingCritical.join(", "),
  );
  console.error(
    "Please set these in your .env before starting the server. The server may fail without them.",
  );
}

require("./config/db"); // Connect to MySQL
require("./config/passport"); // Load Passport strategies (guarded inside the module)
const resumeRoutes = require("./routes/resumeRoutes");
const adminRoutes = require("./routes/adminRoutes");

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", // Add your frontend port
  "https://nexus.prosummo.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log("Allowed origins:", allowedOrigins);

const app = express();

// Middleware

// Important: expose a raw webhook endpoint before express.json body parser
// so Stripe webhook signature verification can access the raw request body.
const billingController = require("./controllers/billingController");
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  billingController.handleWebhook,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());

app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set secure: true in production with HTTPS
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Add this before your routes to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes with rate limiting
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/billing", apiLimiter, billingRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/resume-parser", parserLimiter, resumeParserRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Authentication API!");
});

app.use("/api/resumes", resumeRoutes);
app.use("/api/user-resume", resumeRoutes);
app.use("/api/resumes/user-resumes", resumeRoutes);
app.use("/api/create-resumes", resumeRoutes);
app.use("/api/admin", apiLimiter, adminRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app;
