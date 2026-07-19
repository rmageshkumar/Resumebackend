const express = require("express");
const passport = require("passport");
const {
  login,
  register,
  checkEmail,
  refreshToken,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  updatePasswordValidation,
} = require("../middlewares/validators");

const router = express.Router();

router.post("/register", registerValidation, register);
//router.post("/login", login);

// Add timeout and better error handling for login route
router.post("/login", loginValidation, async (req, res) => {
  let isResponseSent = false;

  try {
    console.log("Login request received:", req.body.email);

    // Set a timeout to prevent hanging requests
    const loginTimeout = setTimeout(() => {
      if (!isResponseSent) {
        console.error("Login request timed out");
        isResponseSent = true;
        res.status(408).json({ message: "Request timeout" });
      }
    }, 15000);

    // Call the login handler
    await login(req, res);

    // Clear the timeout
    clearTimeout(loginTimeout);
    isResponseSent = true;
  } catch (error) {
    // Only send error response if one hasn't been sent already
    if (!isResponseSent) {
      console.error("Login error:", error);
      isResponseSent = true;
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  }
});

// Check email availability
router.get("/check-email", checkEmail);

// Token refresh
router.post("/refresh", refreshToken);

// Forgot password route
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);

// Reset password route
router.post("/reset-password", resetPasswordValidation, resetPassword);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
const jwt = require("jsonwebtoken");

// Helper to generate JWT and redirect with token
const oauthCallback = (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/login?error=oauth_failed`,
    );
  }
  // Generate JWT token with 30-day expiry
  const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  // Redirect to frontend social-callback page with token
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/social-callback?token=${token}`,
  );
};

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=google_denied`,
    session: false,
  }),
  oauthCallback,
);

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);
router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=github_denied`,
    session: false,
  }),
  oauthCallback,
);

router.get(
  "/linkedin",
  passport.authenticate("linkedin", { state: "SOME STATE" }),
);
router.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=linkedin_denied`,
    session: false,
  }),
  oauthCallback,
);

router.get(
  "/me",
  (req, res, next) => {
    console.log("ME endpoint hit, headers:", req.headers.authorization);
    next();
  },
  (req, res, next) => {
    // Custom middleware to handle JWT verification manually if needed
    passport.authenticate("jwt", { session: false }, (err, user, info) => {
      console.log("JWT auth result:", {
        error: err ? err.message : null,
        userExists: !!user,
        info,
      });

      if (err) {
        return res
          .status(500)
          .json({ message: "Authentication error", error: err.message });
      }

      if (!user) {
        return res.status(401).json({ message: "Unauthorized", info });
      }

      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    try {
      console.log("User authenticated successfully:", req.user);
      // Return only necessary user information
      const { password, ...userWithoutPassword } = req.user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Add a test endpoint to verify token processing
router.get(
  "/test-token",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.status(200).json({ valid: true, message: "Token is valid" });
  },
);

// Add profile update route
router.put(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  updateProfileValidation,
  updateProfile,
);

// Add password update route
router.put(
  "/password",
  passport.authenticate("jwt", { session: false }),
  updatePasswordValidation,
  updatePassword,
);

module.exports = router;
