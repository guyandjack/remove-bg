import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import { cancelSubscriptionController } from "../controleur/subscription/cancelSubscription.controller.js";
import { resumeSubscriptionController } from "../controleur/subscription/resumeSubscription.controller.js";
import { changePlanController } from "../controleur/subscription/changePlan.controller.js";

const router = express.Router();

router.post("/cancel", verifyAuth, cancelSubscriptionController);
router.post("/resume", verifyAuth, resumeSubscriptionController);
router.post("/change-plan", verifyAuth, changePlanController);

export default router;
