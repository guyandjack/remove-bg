import express from "express";
import { checkLoginDataUser } from "../middelware/chekDataAuth/checkLoginDataUser";
import {  } from "../controleur/loginDataUser.controler";
import {login} from "../controleur/loginDataUser.controler";

const router = express.Router();

router.post("/", checkLoginDataUser, login );

export default router;
