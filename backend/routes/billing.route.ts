import express from "express";
import { billingStatusController } from "../controleur/billing/billingStatus.controller";

const router = express.Router();

// Public endpoint (no auth): uses Stripe session_id + server-side verification.
router.get("/status", billingStatusController);

export default router;

