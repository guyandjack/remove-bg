import express from "express";
import { getPlanOption } from "../controleur/getPlanOption.controler";

const router = express.Router();

router.get("/", getPlanOption);

export default router;
