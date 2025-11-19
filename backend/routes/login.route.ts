import express from "express";
import { checkLoginDataUser } from "../middelware/chekDataAuth/checkLoginDataUser";
import {  } from "../controleur/loginDataUser.controler";

const router = express.Router();

router.post("/", checkLoginDataUser, );

export default router;
