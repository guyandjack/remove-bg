import express from "express";
import { checkResetPassword } from "../middelware/chekDataAuth/checkResetPassword.js";
import { resetPassword } from "../controleur/resetPassword.controler.js";

const router = express.Router();

router.post("/", checkResetPassword, resetPassword);

export default router;

