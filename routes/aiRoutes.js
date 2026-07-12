const express = require("express");
const passport = require("passport");
const aiController = require("../controllers/aiController");
const { requirePlan } = require("../middlewares/subscriptionMiddleware");
const { auditMiddleware } = require("../middlewares/auditLogger");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

// AI features require premium subscription
router.post(
  "/analyze-resume",
  authenticate,
  requirePlan("premium"),
  aiController.analyzeResume,
  auditMiddleware("ai.analyze-resume", "resume"),
);

module.exports = router;
