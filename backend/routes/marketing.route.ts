import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import {
  updateMarketingConsentController,
} from "../controleur/marketing/marketingConsent.controller.js";

const router = express.Router();

router.post("/consent", verifyAuth, updateMarketingConsentController);

export default router;
