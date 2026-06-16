const express = require("express");
const passport = require("passport");
const aiController = require("../controllers/aiController");

const router = express.Router();
const authenticate = passport.authenticate("jwt", { session: false });

router.post("/analyze-resume", authenticate, aiController.analyzeResume);

module.exports = router;
