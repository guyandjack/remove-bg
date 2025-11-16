import express from "express";
import { stripeWebhook } from "../controleur/stripeWebhook.controler";


const router = express.Router();

router.post("/webhook", stripeWebhook);

export default router;
