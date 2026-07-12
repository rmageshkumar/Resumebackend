const express = require("express");
const passport = require("passport");
const billingController = require("../controllers/billingController");
const {
  createCheckoutValidation,
  subscribePlanValidation,
  templateCheckoutValidation,
  purchaseTemplateValidation,
} = require("../middlewares/validators");
const { auditMiddleware } = require("../middlewares/auditLogger");

const router = express.Router();

router.post(
  "/checkout-session",
  passport.authenticate("jwt", { session: false }),
  createCheckoutValidation,
  billingController.createCheckoutSession,
  auditMiddleware("billing.checkout-session", "subscription"),
);

router.post(
  "/template-checkout-session",
  passport.authenticate("jwt", { session: false }),
  templateCheckoutValidation,
  billingController.createTemplateCheckoutSession,
  auditMiddleware("billing.template-checkout", "template"),
);

router.post(
  "/subscribe",
  passport.authenticate("jwt", { session: false }),
  subscribePlanValidation,
  billingController.subscribePlan,
  auditMiddleware("billing.subscribe", "subscription"),
);

router.post(
  "/purchase-template",
  passport.authenticate("jwt", { session: false }),
  purchaseTemplateValidation,
  billingController.purchaseTemplate,
  auditMiddleware("billing.purchase-template", "template"),
);

router.get(
  "/subscription",
  passport.authenticate("jwt", { session: false }),
  billingController.getSubscription,
);

router.get(
  "/purchases",
  passport.authenticate("jwt", { session: false }),
  billingController.getPurchases,
);

// Cancel subscription (downgrade to free)
router.post(
  "/cancel",
  passport.authenticate("jwt", { session: false }),
  billingController.cancelSubscription,
  auditMiddleware("billing.cancel", "subscription"),
);

// Stripe Customer Portal for managing payment methods / invoices
router.get(
  "/portal",
  passport.authenticate("jwt", { session: false }),
  billingController.createPortalSession,
);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  billingController.handleWebhook,
);

module.exports = router;
