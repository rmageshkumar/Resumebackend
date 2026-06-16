const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../server");
const User = require("../models/userModel");

jest.mock("stripe", () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: "cus_test" }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          url: "https://checkout.stripe.com/test-session",
          subscription: "sub_test",
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn((payload) => {
        let body = payload;
        if (Buffer.isBuffer(payload)) {
          body = JSON.parse(payload.toString());
        } else if (typeof payload === "string") {
          body = JSON.parse(payload);
        }
        const metadata = body.metadata || body.data?.object?.metadata || {};
        return {
          type: "checkout.session.completed",
          data: {
            object: {
              metadata,
              subscription: "sub_test",
            },
          },
        };
      }),
    },
  }));
});

const dbUser = {
  name: "billing-test-user",
  email: "billing-test@example.com",
  password: "Test1234!",
};

let token;
let userId;

beforeAll(async () => {
  const pwHash = await bcrypt.hash(dbUser.password, 10);
  const existing = await User.findUserByEmail(dbUser.email);
  if (existing) {
    userId = existing.id;
  } else {
    const insertId = await User.createUser(
      dbUser.name,
      dbUser.email,
      pwHash,
      "local",
    );
    userId = insertId;
  }

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: dbUser.email, password: dbUser.password });

  token = loginRes.body.token;
});

afterAll(async () => {
  const db = require("../config/db");
  const [result] = await db.execute(
    "DELETE FROM template_purchases WHERE user_id = ?",
    [userId],
  );
  await db.execute("DELETE FROM users WHERE id = ?", [userId]);
  await db.end();
});

describe("Billing routes", () => {
  it("should create a Stripe checkout session for a premium template", async () => {
    const response = await request(app)
      .post("/api/billing/template-checkout-session")
      .set("Authorization", `Bearer ${token}`)
      .send({
        templateId: "executive",
        price: "$9",
        templateName: "Executive Resume Template",
      });

    expect(response.status).toBe(200);
    expect(response.body.url).toBe("https://checkout.stripe.com/test-session");
  });

  it("should record a template purchase when webhook is received", async () => {
    const payload = {
      metadata: {
        userId,
        templateId: "executive",
        price: "$9",
      },
    };

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Stripe-Signature", "test-signature")
      .set("Content-Type", "application/json")
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);

    const purchase = await User.findTemplatePurchase(userId, "executive");
    expect(purchase).toBeDefined();
    expect(purchase.template_id).toBe("executive");
    expect(purchase.price).toBe("$9");
  });
});
