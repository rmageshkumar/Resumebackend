const Stripe = require("stripe");
const User = require("../models/userModel");
const pool = require("../config/db");

const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (stripeKey) {
  try {
    stripe = Stripe(stripeKey);
  } catch (err) {
    console.error("Invalid STRIPE_SECRET_KEY:", err.message);
    stripe = null;
  }
} else {
  console.warn(
    "STRIPE_SECRET_KEY not set — Stripe endpoints will be disabled.",
  );
}

const PRICE_IDS = {
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

const getStripeCustomer = async (user) => {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await User.updateStripeCustomerId(user.id, customer.id);
  return customer.id;
};

const parsePriceToCents = (price) => {
  if (!price) return null;
  const cleaned = price.toString().replace(/[^0-9.]/g, "");
  const floatValue = parseFloat(cleaned);
  if (Number.isNaN(floatValue) || floatValue <= 0) return null;
  return Math.round(floatValue * 100);
};

exports.createTemplateCheckoutSession = async (req, res) => {
  try {
    const { templateId, price, templateName } = req.body;
    if (!stripe) {
      return res
        .status(500)
        .json({ message: "Stripe is not configured for template payments." });
    }

    if (!templateId || !price) {
      return res
        .status(400)
        .json({ message: "Template ID and price are required." });
    }

    const priceInCents = parsePriceToCents(price);
    if (!priceInCents) {
      return res
        .status(400)
        .json({ message: "Invalid template price format." });
    }

    const user = req.user;
    if (!user)
      return res.status(401).json({ message: "Authentication required" });

    const customerId = await getStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: templateName || "Premium Resume Template",
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        templateId,
        templateName: templateName || "Premium Template",
        price: price.toString(),
      },
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pricing?session_id={CHECKOUT_SESSION_ID}&success=true&template_id=${templateId}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pricing?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe template checkout session creation failed:", error);
    res
      .status(500)
      .json({ message: "Failed to create template checkout session" });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!stripe) {
      return res.status(500).json({
        message:
          "Stripe is not configured (STRIPE_SECRET_KEY missing or invalid).",
      });
    }

    if (!plan || !PRICE_IDS[plan]) {
      return res
        .status(400)
        .json({ message: "Invalid plan selected or price id not configured." });
    }

    const user = req.user;
    if (!user)
      return res.status(401).json({ message: "Authentication required" });

    const customerId = await getStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        plan,
      },
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pricing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pricing?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session creation failed:", error);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
};

exports.subscribePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ message: "Plan is required" });
    }

    const user = req.user;
    await User.updateUserSubscription(user.id, {
      subscription_plan: plan,
      subscription_status: plan === "free" ? "inactive" : "active",
    });

    const updatedUser = await User.findUserById(user.id);
    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error("Failed to update subscription:", error);
    res.status(500).json({ message: "Unable to update subscription" });
  }
};

exports.purchaseTemplate = async (req, res) => {
  try {
    const { templateId, price } = req.body;
    if (!templateId) {
      return res.status(400).json({ message: "Template ID is required" });
    }

    const userId = req.user.id;

    const existing = await User.findTemplatePurchase(userId, templateId);
    if (existing) {
      return res.status(409).json({ message: "Template already purchased" });
    }

    const numericPrice = price
      ? parseFloat(price.toString().replace(/[^0-9.]/g, ""))
      : null;

    await User.addTemplatePurchase(userId, templateId, numericPrice);
    res.json({ success: true, templateId });
  } catch (error) {
    console.error("Failed to record template purchase:", error);
    res.status(500).json({ message: "Unable to complete template purchase" });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const user = await User.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      plan: user.subscription_plan || "free",
      status: user.subscription_status || "inactive",
      stripeCustomerId: user.stripe_customer_id || null,
      stripeSubscriptionId: user.stripe_subscription_id || null,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    res.status(500).json({ message: "Unable to fetch subscription" });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const purchases = await User.getUserTemplatePurchases(req.user.id);
    res.json({ purchases });
  } catch (error) {
    console.error("Failed to fetch template purchases:", error);
    res.status(500).json({ message: "Unable to fetch purchases" });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    console.error("Stripe not configured — cannot handle webhook");
    return res.status(500).json({ message: "Stripe not configured on server" });
  }

  if (!webhookSecret) {
    console.error(
      "STRIPE_WEBHOOK_SECRET not set — cannot verify webhook signature",
    );
    return res
      .status(400)
      .json({ message: "Webhook secret not configured on server" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
      case "checkout.session.completed": {
        const session = object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        const templateId = session.metadata?.templateId;
        const templatePrice = session.metadata?.price;

        if (userId && plan) {
          await User.updateUserSubscription(userId, {
            subscription_plan: plan,
            subscription_status: "active",
            stripe_subscription_id: session.subscription,
          });
        } else if (userId && templateId) {
          const existingPurchase = await User.findTemplatePurchase(
            userId,
            templateId,
          );
          if (!existingPurchase) {
            await User.addTemplatePurchase(userId, templateId, templatePrice);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const subscriptionId = object.subscription;
        if (subscriptionId) {
          await User.updateSubscriptionStatusByStripeId(
            subscriptionId,
            "past_due",
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscriptionId = object.id;
        if (subscriptionId) {
          await User.updateSubscriptionStatusByStripeId(
            subscriptionId,
            "canceled",
          );
        }
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error handling Stripe webhook event:", error);
    res.status(500).json({ message: "Webhook handling failed" });
  }
};
