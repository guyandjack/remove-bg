import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import { cancelSubscriptionController } from "../controleur/subscription/cancelSubscription.controller";
import { resumeSubscriptionController } from "../controleur/subscription/resumeSubscription.controller";

const router = express.Router();

router.post("/cancel", verifyAuth, cancelSubscriptionController);
router.post("/resume", verifyAuth, resumeSubscriptionController);

export default router;
