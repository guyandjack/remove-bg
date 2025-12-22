import express from "express";
import { checkResetPassword } from "../middelware/chekDataAuth/checkResetPassword";
import { resetPassword } from "../controleur/resetPassword.controler";

const router = express.Router();

router.post("/", checkResetPassword, resetPassword);

export default router;
