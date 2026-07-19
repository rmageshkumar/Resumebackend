require("dotenv").config();
const Stripe = require("stripe");
const key = process.env.STRIPE_SECRET_KEY;
console.log("Stripe key set:", !!key);
console.log("Key prefix:", key ? key.substring(0, 20) + "..." : "none");
if (key) {
  try {
    const stripe = Stripe(key);
    console.log("Stripe instance: OK");
  } catch (e) {
    console.log("Stripe init error:", e.message);
  }
}
console.log("Price premium:", process.env.STRIPE_PRICE_PREMIUM);
