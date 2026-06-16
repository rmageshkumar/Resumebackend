# Stripe Setup for userauthentication

## Required environment variables

Add these values to `userauthentication/.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PRICE_PREMIUM=price_your_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

- `STRIPE_SECRET_KEY`: your Stripe secret key
- `STRIPE_PRICE_PREMIUM`: the Stripe Price ID for the premium subscription plan
- `STRIPE_WEBHOOK_SECRET`: the webhook signing secret from Stripe

## Webhook forwarding command

Use Stripe CLI to forward webhook events to the local backend:

```bash
cd /Users/magesh/Desktop/Develop.nosync/Projects/userauthentication
stripe listen --forward-to http://localhost:5001/api/billing/webhook
```

When Stripe outputs a webhook secret, copy it into `STRIPE_WEBHOOK_SECRET` in `.env`.

## After setup

1. Restart the backend server.
2. Use the frontend pricing page to create a subscription checkout session.
3. Complete checkout using Stripe test cards.
4. Verify backend receives the webhook and updates subscription state.
