import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import {authMe} from "../controleur/authMe.controler.js"

const router = express.Router();

router.post("", verifyAuth, authMe);

export default router;
