import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import {
  accountDeletionRequestController,
} from "../controleur/account/deletionRequest.controller";
import { billingAccountStatusController } from "../controleur/account/billingAccountStatus.controller";

const router = express.Router();

router.post("/deletion-request", verifyAuth, accountDeletionRequestController);
router.get("/billing-account", verifyAuth, billingAccountStatusController);

export default router;
