import express from "express";
import { checkDataFormContact } from "../middelware/checkDataFormContact/checkDataFormContact.ts";
import { contactRateLimiter } from "../middelware/rateLimit/contactRateLimiter.ts";
import { sendContactEmail } from "../controleur/contactDataUser.controler.ts";

const router = express.Router();

router.post("/", contactRateLimiter, checkDataFormContact, sendContactEmail);

export default router;
