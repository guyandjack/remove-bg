import express from "express";
import { billingStatusController } from "../controleur/billing/billingStatus.controller.js";

const router = express.Router();

// Public endpoint (no auth): uses Stripe session_id + server-side verification.
router.get("/status", billingStatusController);

export default router;

