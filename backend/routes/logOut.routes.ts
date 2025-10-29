import express from "express";
import { logOut } from "../controleur/logOut";


const router = express.Router();

router.post("/", logOut /* sendMailVerification */);

export default router;
