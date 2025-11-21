import express from "express";


import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import { checkDataUsageDownload } from "../middelware/checkDataUsage/checkDataUsageDowload";
import { updateUserDownload } from "../controleur/usage/updateUserDowmload";

const router = express.Router();

router.post("/download", verifyAuth, checkDataUsageDownload, updateUserDownload);

export default router;
