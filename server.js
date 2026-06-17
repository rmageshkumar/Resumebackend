const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
// Load environment variables early so other modules can read them
dotenv.config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const aiRoutes = require("./routes/aiRoutes");

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

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", // Add your frontend port
  process.env.FRONTEND_URL,
].filter(Boolean);

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Authentication API!");
});

app.use("/api/resumes", resumeRoutes);
app.use("api/user-resume", resumeRoutes);
app.use("api/resumes/user-resumes", resumeRoutes);
app.use("api/create-resumes", resumeRoutes);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app;
