const express = require("express");
const passport = require("passport");
const adminController = require("../controllers/adminController");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

// Simple admin check middleware — checks user is admin (id=1 or email contains "admin")
const requireAdmin = async (req, res, next) => {
  try {
    const pool = require("../config/db");
    const userId = req.user?.userId || req.user?.id;
    const userEmail = req.user?.email || "";

    // Check is_admin column in database
    const [[user]] = await pool.query(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId],
    );

    if (user?.is_admin) return next();

    // Fallback for legacy
    if (userId === 1) return next();
    if (userEmail === "mageshkumar.it@gmail.com") return next();

    return res.status(403).json({ message: "Admin access required" });
  } catch (err) {
    console.error("Admin check error:", err);
    return res.status(403).json({ message: "Admin access required" });
  }
};

// Apply admin check to all routes
router.use(authenticate, requireAdmin);

// Dashboard stats
router.get("/stats", adminController.getDashboardStats);

// User management
router.get("/users", adminController.listUsers);

// Revenue analytics
router.get("/revenue", adminController.getRevenueAnalytics);

// Recent activity
router.get("/activity", adminController.getRecentActivity);

// Grant admin privileges (admin only)
router.post("/grant-admin", adminController.grantAdmin);

module.exports = router;
