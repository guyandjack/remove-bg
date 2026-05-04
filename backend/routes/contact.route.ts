import express from "express";
import { checkDataFormContact } from "../middelware/checkDataFormContact/checkDataFormContact.js";
import { contactRateLimiter } from "../middelware/rateLimit/contactRateLimiter.js";
import { sendContactEmail } from "../controleur/contactDataUser.controler.js";

const router = express.Router();

router.post("/", contactRateLimiter, checkDataFormContact, sendContactEmail);

export default router;
