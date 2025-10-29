import express from "express";
import { verifyAuth } from "../controleur/verifyAuth";

const router = express.Router();

router.get("/auth/me", verifyAuth);

export default router;