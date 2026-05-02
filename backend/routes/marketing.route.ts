import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import {
  updateMarketingConsentController,
} from "../controleur/marketing/marketingConsent.controller";

const router = express.Router();

router.post("/consent", verifyAuth, updateMarketingConsentController);

export default router;
