import express from "express";


import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import { checkDataUsageDownload } from "../middelware/checkDataUsage/checkDataUsageDowload.js";
import { updateUserDownload } from "../controleur/usage/updateUserDowmload.js";

const router = express.Router();

router.post("/download", verifyAuth, checkDataUsageDownload, updateUserDownload);

export default router;
