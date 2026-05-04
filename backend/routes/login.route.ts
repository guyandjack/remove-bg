import express from "express";
import { checkLoginDataUser } from "../middelware/chekDataAuth/checkLoginDataUser.js";
import {  } from "../controleur/loginDataUser.controler.js";
import {login} from "../controleur/loginDataUser.controler.js";

const router = express.Router();

router.post("/", checkLoginDataUser, login );

export default router;
