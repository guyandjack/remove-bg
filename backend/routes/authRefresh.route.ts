import express from "express";
import { checkRefreshToken } from "../middelware/checkRefreshToken/checkRefreshToken";
import { refreshAuth } from "../controleur/refreshAuth.controler";

const router = express.Router();

router.post("", checkRefreshToken, refreshAuth);

export default router;
