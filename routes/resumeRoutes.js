const express = require("express");
const passport = require("passport");
const resumeController = require("../controllers/resumeController");
const coverController = require("../controllers/coverController");

const router = express.Router();

// Middleware to authenticate all resume routes
const authenticate = passport.authenticate("jwt", { session: false });

// Cover letter routes (Moved to top to avoid conflict with /:id wildcard)
router.post(
  "/cover-letters/create",
  authenticate,
  coverController.createCoverLetter
);
router.get("/cover-letters", authenticate, coverController.getUserCoverLetters);
router.get(
  "/cover-letters/:coverId",
  authenticate,
  coverController.getCoverLetterById
);
router.put(
  "/cover-letters/:coverId",
  authenticate,
  coverController.updateCoverLetter
);
router.delete(
  "/cover-letters/:coverId",
  authenticate,
  coverController.deleteCoverLetter
);

// Main resume routes
router.post("/create-resumes", authenticate, resumeController.createResume);
router.get("/", authenticate, resumeController.getUserResumes);
router.get("/:id([a-zA-Z0-9-]+)", authenticate, resumeController.getResumeById);
router.put(
  "/user-resumes/:id",
  authenticate,
  resumeController.updateResumeDetail
);

router.delete("/:id", authenticate, resumeController.deleteResumeById);

router.put(
  "/:id/template",
  authenticate,
  resumeController.updateResumeTemplate
);

// Custom sections routes
router.post(
  "/:id/custom-sections",
  authenticate,
  resumeController.addCustomSection
);
router.put(
  "/:id/custom-sections/:sectionId",
  authenticate,
  resumeController.updateCustomSection
);
router.delete(
  "/:id/custom-sections/:sectionId",
  authenticate,
  resumeController.deleteCustomSection
);
router.put(
  "/:id/custom-sections",
  authenticate,
  resumeController.saveCustomSections
);

// Education routes
router.post("/:id/education", authenticate, resumeController.addEducation);
router.put(
  "/:id/education/:educationId",
  authenticate,
  resumeController.updateEducation
);
router.delete(
  "/:id/education/:educationId",
  authenticate,
  resumeController.deleteEducation
);

// Experience routes
router.post("/:id/experience", authenticate, resumeController.addExperience);
router.put(
  "/:id/experience/:experienceId",
  authenticate,
  resumeController.updateExperience
);

router.delete(
  "/:id/experience/:experienceId",
  authenticate,
  resumeController.deleteExperience
);

// Skills routes
router.post("/:id/skills", authenticate, resumeController.addSkill);
router.put("/:id/skills/:skillId", authenticate, resumeController.updateSkill);
router.delete(
  "/:id/skills/:skillId",
  authenticate,
  resumeController.deleteSkill
);

// Language routes
router.post("/:id/languages", authenticate, resumeController.addLanguage);
router.put(
  "/:id/languages/:languageId",
  authenticate,
  resumeController.updateLanguage
);
router.delete(
  "/:id/languages/:languageId",
  authenticate,
  resumeController.deleteLanguage
);

// Certification routes
router.post(
  "/:id/certifications",
  authenticate,
  resumeController.addCertification
);
router.put(
  "/:id/certifications/:certificationId",
  authenticate,
  resumeController.updateCertification
);
router.delete(
  "/:id/certifications/:certificationId",
  authenticate,
  resumeController.deleteCertification
);

// Analytics routes
router.get("/analytics/:id", authenticate, resumeController.getResumeAnalytics);
router.post("/analytics/view", resumeController.trackResumeView);

module.exports = router;
