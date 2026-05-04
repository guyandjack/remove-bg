import express from "express";
import { checkForgotPassword } from "../middelware/chekDataAuth/checkForgotPassword.js";
import { forgotPassword } from "../controleur/forgotPassword.controler.js";

const router = express.Router();

// POST /forgot-password
router.post("/", checkForgotPassword, forgotPassword);

export default router;

