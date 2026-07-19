const express = require("express");
const passport = require("passport");
const cmsController = require("../controllers/cmsController");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

// Simple admin check middleware
const requireAdmin = async (req, res, next) => {
  try {
    const pool = require("../config/db");
    const userId = req.user?.userId || req.user?.id;
    const [[user]] = await pool.query(
      "SELECT is_admin FROM users WHERE id = ?",
      [userId],
    );
    if (user?.is_admin) return next();
    return res.status(403).json({ message: "Admin access required" });
  } catch (err) {
    return res.status(403).json({ message: "Admin access required" });
  }
};

// Public routes
router.get("/pages/:slug", cmsController.getPage);
router.post("/contact", cmsController.submitContact);

// Admin routes
router.get("/admin/pages", authenticate, requireAdmin, cmsController.listPages);
router.get(
  "/admin/pages/:id",
  authenticate,
  requireAdmin,
  cmsController.getPageById,
);
router.put(
  "/admin/pages/:id",
  authenticate,
  requireAdmin,
  cmsController.updatePage,
);
router.get(
  "/admin/settings/emails",
  authenticate,
  requireAdmin,
  cmsController.getAdminEmail,
);
router.post(
  "/admin/settings/emails",
  authenticate,
  requireAdmin,
  cmsController.addAdminEmail,
);
router.delete(
  "/admin/settings/emails",
  authenticate,
  requireAdmin,
  cmsController.deleteAdminEmail,
);
router.get(
  "/admin/contacts",
  authenticate,
  requireAdmin,
  cmsController.listContacts,
);

module.exports = router;
