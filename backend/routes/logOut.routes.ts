import express from "express";
import { logOut } from "../controleur/logOut.controler.js";
import {verifyAuth}  from "../middelware/verifAuth/verifyAuth.js"


const router = express.Router();

router.post("/", verifyAuth, logOut);

export default router;
