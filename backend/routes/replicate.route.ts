import express from "express";
import { verifyReplicateWebhook } from "../middelware/replicate/verifyReplicateWebhook.middleware.js";
import { replicateWebhook } from "../controleur/replicate/replicateWebhook.controller.js";

const router = express.Router();

// Replicate requires the raw request body for signature verification.
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  verifyReplicateWebhook(),
  replicateWebhook,
);

export default router;

