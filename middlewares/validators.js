const { body, validationResult } = require("express-validator");

/**
 * Middleware to check validation results and return formatted errors.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ── Auth Validators ──

const registerValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name must be between 1 and 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must be between 1 and 50 characters"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be at least 8 characters"),
  handleValidationErrors,
];

const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const forgotPasswordValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  handleValidationErrors,
];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be at least 8 characters"),
  handleValidationErrors,
];

const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("bio")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Bio must not exceed 500 characters"),
  body("phone")
    .optional()
    .matches(/^[+]?[\d\s()-]{7,20}$/)
    .withMessage("Invalid phone number format"),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  handleValidationErrors,
];

const updatePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8, max: 128 })
    .withMessage("New password must be at least 8 characters"),
  handleValidationErrors,
];

// ── Billing Validators ──

const createCheckoutValidation = [
  body("plan")
    .isIn(["free", "premium"])
    .withMessage("Plan must be 'free' or 'premium'"),
  handleValidationErrors,
];

const subscribePlanValidation = [
  body("plan")
    .isIn(["free", "premium"])
    .withMessage("Plan must be 'free' or 'premium'"),
  handleValidationErrors,
];

const templateCheckoutValidation = [
  body("templateId")
    .notEmpty()
    .isString()
    .withMessage("Template ID is required"),
  body("price").notEmpty().withMessage("Price is required"),
  handleValidationErrors,
];

const purchaseTemplateValidation = [
  body("templateId")
    .notEmpty()
    .isString()
    .withMessage("Template ID is required"),
  handleValidationErrors,
];

// ── Resume Validators ──

const createResumeValidation = [
  body("title").trim().notEmpty().withMessage("Resume title is required"),
  body("firstName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("First name must not exceed 100 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Last name must not exceed 100 characters"),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  updatePasswordValidation,
  createCheckoutValidation,
  subscribePlanValidation,
  templateCheckoutValidation,
  purchaseTemplateValidation,
  createResumeValidation,
};
