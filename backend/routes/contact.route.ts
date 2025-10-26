import express from "express";
import { checkDataFormContact } from "../middelware/checkDataFormContact/checkDataFormContact.ts";
import { sendContactEmail } from "../controleur/contactDataUser.controler.ts";

const router = express.Router();

router.post("/", checkDataFormContact , sendContactEmail);

export default router;
