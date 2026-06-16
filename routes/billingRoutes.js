const express = require("express");
const passport = require("passport");
const billingController = require("../controllers/billingController");

const router = express.Router();

router.post(
  "/checkout-session",
  passport.authenticate("jwt", { session: false }),
  billingController.createCheckoutSession,
);

router.post(
  "/template-checkout-session",
  passport.authenticate("jwt", { session: false }),
  billingController.createTemplateCheckoutSession,
);

router.post(
  "/subscribe",
  passport.authenticate("jwt", { session: false }),
  billingController.subscribePlan,
);

router.post(
  "/purchase-template",
  passport.authenticate("jwt", { session: false }),
  billingController.purchaseTemplate,
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

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  billingController.handleWebhook,
);

module.exports = router;
