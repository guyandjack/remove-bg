import express from "express";
import { checkLoginDataUser } from "../middelware/chekDataAuth/checkLoginDataUser";
//import { sendMailVerification } from "../controleur/loginDataUser.controler";

const router = express.Router();

router.post("/", checkLoginDataUser, /* sendMailVerification */);

export default router;
