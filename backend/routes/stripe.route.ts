import express from "express";
import { stripeWebhook } from "../controleur/stripe/stripeWebhook.controler";
import { finalizeStripeCheckout } from "../controleur/stripe/stripeFinalize.controller";

const router = express.Router();
const jsonParser = express.json({ type: "application/json" });

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

router.post("/finalize", jsonParser, finalizeStripeCheckout);

export default router;
