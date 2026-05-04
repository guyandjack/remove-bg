import express from "express";
import { sendMailVerification } from "../controleur/signUpDataUser.controler.js";
import { checkSignUpDataUser } from "../middelware/chekDataAuth/checkSignUpDataUser.js";
import { checkSignUpOtpUser } from "../middelware/chekDataAuth/checkSignUpOtpUser.js";
import { createNewAccountUser } from "../controleur/signUpOtpUser.controler.js";

const router = express.Router();

router.post("/check/user", checkSignUpDataUser, sendMailVerification);
router.post("/check/otp", checkSignUpOtpUser, createNewAccountUser);

export default router;
