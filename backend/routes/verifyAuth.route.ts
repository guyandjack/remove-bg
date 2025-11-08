import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import {authMe} from "../controleur/authMe"

const router = express.Router();

router.post("", verifyAuth, authMe);

export default router;