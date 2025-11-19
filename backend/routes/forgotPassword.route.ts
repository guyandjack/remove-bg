import express from "express";
import { checkForgotPassword } from "../middelware/chekDataAuth/checkForgotPassword";
import { forgotPassword } from "../controleur/forgotPassword.controler";

const router = express.Router();

// POST /forgot-password
router.post("/", checkForgotPassword, forgotPassword);

export default router;
