import express from "express";
import { logOut } from "../controleur/logOut";
import {verifyAuth}  from "../middelware/verifAuth/verifyAuth"


const router = express.Router();

router.post("/", verifyAuth, logOut /* sendMailVerification */);

export default router;
