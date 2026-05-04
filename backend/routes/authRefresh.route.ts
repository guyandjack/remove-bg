import express from "express";
import { checkRefreshToken } from "../middelware/checkRefreshToken/checkRefreshToken.js";
import { refreshAuth } from "../controleur/refreshAuth.controler.js";

const router = express.Router();

router.post("", checkRefreshToken, refreshAuth);

export default router;
