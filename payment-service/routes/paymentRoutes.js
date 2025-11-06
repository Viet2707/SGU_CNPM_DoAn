// routes/paymentRoutes.js — BẢN CHUẨN
const express = require("express");
const router = express.Router();

const { verifyToken, allowRoles } = require("../utils/authMiddleware");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");

// ❌ BỎ KẾT NỐI MONGO Ở ĐÂY — server.js đã connect rồi
// mongoose.connect(...)

// ✅ Khởi tạo Stripe theo kiểu an toàn
const Stripe = require("stripe");
const stripeKey = process.env.STRIPE_SECRET_KEY;

// Nếu thiếu key, tạm disable các route Stripe để tránh crash
if (!stripeKey) {
  console.warn(
    "⚠️  STRIPE_SECRET_KEY missing — payment routes disabled (dev fallback)"
  );
  router.post("/customer", verifyToken, allowRoles("customer"), (_req, res) =>
    res
      .status(503)
      .json({ message: "Payment disabled (missing STRIPE_SECRET_KEY)" })
  );
  router.post(
    "/create-payment-intent",
    verifyToken,
    allowRoles("customer"),
    (_req, res) =>
      res
        .status(503)
        .json({ message: "Payment disabled (missing STRIPE_SECRET_KEY)" })
  );
  router.get(
    "/verify-payment/:paymentIntentId",
    verifyToken,
    allowRoles("customer"),
    (_req, res) =>
      res
        .status(503)
        .json({ message: "Payment disabled (missing STRIPE_SECRET_KEY)" })
  );
  router.post(
    "/update/:paymentIntentId",
    verifyToken,
    allowRoles("customer"),
    (_req, res) =>
      res
        .status(503)
        .json({ message: "Payment disabled (missing STRIPE_SECRET_KEY)" })
  );
  module.exports = router;
  return;
}

const stripe = Stripe(stripeKey);

// ========== Các route thật ==========
router.post(
  "/customer",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || !name)
        return res.status(400).json({ message: "Email and name are required" });

      let payment = await Payment.findOne({ userId: req.user.id });
      let stripeCustomerId = payment?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email,
          name,
          metadata: { userId: req.user.id },
        });
        stripeCustomerId = customer.id;

        if (payment) {
          payment.stripeCustomerId = stripeCustomerId;
          await payment.save();
        } else {
          await new Payment({
            userId: req.user.id,
            stripeCustomerId,
            amount: 0,
            currency: "usd",
            status: "canceled",
          }).save();
        }
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
      });

      res.json({
        stripeCustomerId,
        paymentMethods: paymentMethods.data || [],
      });
    } catch (err) {
      console.error("Customer creation error:", err);
      res
        .status(500)
        .json({ message: "Failed to manage customer", error: err.message });
    }
  }
);

router.post(
  "/create-payment-intent",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const { amount, currency, metadata, billingDetails } = req.body;
    if (!amount || !currency || !billingDetails) {
      return res.status(400).json({
        message: "Amount, currency, and billing details are required",
      });
    }

    try {
      let payment = await Payment.findOne({ userId: req.user.id });
      let stripeCustomerId = payment?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: billingDetails.email,
          name: billingDetails.name,
          address: billingDetails.address,
          metadata: { userId: req.user.id },
        });
        stripeCustomerId = customer.id;
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: stripeCustomerId,
        metadata,
        automatic_payment_methods: { enabled: true },
        setup_future_usage: "on_session",
      });

      const newPayment = new Payment({
        paymentIntentId: paymentIntent.id,
        userId: req.user.id,
        stripeCustomerId,
        amount,
        currency,
        status: paymentIntent.status,
        billingName: billingDetails.name,
        billingEmail: billingDetails.email,
        billingAddress: billingDetails.address,
      });

      await newPayment.save();

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
      console.error("PaymentIntent creation error:", err);
      if (err.name === "ValidationError") {
        return res
          .status(400)
          .json({ message: "Payment validation failed", details: err.errors });
      }
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  }
);

router.get(
  "/verify-payment/:paymentIntentId",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const { paymentIntentId } = req.params;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      await Payment.findOneAndUpdate(
        { paymentIntentId },
        { status: paymentIntent.status },
        { new: true }
      );
      res.json({ status: paymentIntent.status });
    } catch (err) {
      console.error("Payment verification error:", err);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  }
);

router.post(
  "/update/:paymentIntentId",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const { paymentIntentId } = req.params;
    const { orderId } = req.body;
    try {
      const payment = await Payment.findOneAndUpdate(
        { paymentIntentId },
        { orderId },
        { new: true }
      );
      if (!payment)
        return res.status(404).json({ message: "Payment not found" });
      res.json({ message: "Payment updated", payment });
    } catch (err) {
      console.error("Payment update error:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  }
);

module.exports = router;
