import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import {
  accountDeletionRequestController,
} from "../controleur/account/deletionRequest.controller.js";
import { billingAccountStatusController } from "../controleur/account/billingAccountStatus.controller.js";
import { changePasswordController } from "../controleur/account/changePassword.controller.js";
import { checkChangePassword } from "../middelware/chekDataAuth/checkChangePassword.js";

const router = express.Router();

router.post("/deletion-request", verifyAuth, accountDeletionRequestController);
router.get("/billing-account", verifyAuth, billingAccountStatusController);
router.post("/change-password", verifyAuth, checkChangePassword, changePasswordController);

export default router;
