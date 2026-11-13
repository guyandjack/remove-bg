import express from "express";
import { checkLoginDataUser } from "../middelware/chekDataAuth/checkLoginDataUser.js";
import {login} from "../controleur/loginDataUser.controler.js";
import { loginRateLimiter } from "../middelware/rateLimit/loginRateLimiter.js";

const router = express.Router();

router.post("/", loginRateLimiter, checkLoginDataUser, login );

export default router;
