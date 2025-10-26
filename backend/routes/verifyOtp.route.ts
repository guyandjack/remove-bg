import express from "express";
import { verifyEmailCodeController } from "../middelware/checkUserEmailValid/emailVerification.ts";

const router = express.Router();

router.post("/", verifyEmailCodeController);

export default router;

