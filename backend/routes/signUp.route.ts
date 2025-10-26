import express from "express";
import { sendMailVerification } from "../controleur/signUpDataUser.controler.ts";
import { checkSignUpDataUser } from "../middelware/chekDataAuth/checkSignUpDataUser.ts";
import { checkSignUpOtpUser } from "../middelware/chekDataAuth/checkSignUpOtpUser.ts";
import { createNewAccountUser } from "../controleur/signUpOtpUser.controler.ts";

const router = express.Router();

router.post("/check/user", checkSignUpDataUser, sendMailVerification);
router.post("/check/otp", checkSignUpOtpUser, createNewAccountUser);

export default router;
