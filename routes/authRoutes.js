const express = require("express");
const passport = require("passport");
const {
  login,
  register,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
//router.post("/login", login);

// Add timeout and better error handling for login route
router.post("/login", async (req, res) => {
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

// Forgot password route
router.post("/forgot-password", forgotPassword);

// Reset password route
router.post("/reset-password", resetPassword);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  },
);

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  },
);

router.get(
  "/linkedin",
  passport.authenticate("linkedin", { state: "SOME STATE" }),
);
router.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  },
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
  (req, res, next) => {
    console.log("Profile update request received");
    next();
  },
  updateProfile,
);

// Add password update route
router.put(
  "/password",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    console.log("Password update request received");
    next();
  },
  updatePassword,
);

module.exports = router;
