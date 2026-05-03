import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth";
import {
  accountDeletionRequestController,
} from "../controleur/account/deletionRequest.controller";
import { billingAccountStatusController } from "../controleur/account/billingAccountStatus.controller";
import { changePasswordController } from "../controleur/account/changePassword.controller";
import { checkChangePassword } from "../middelware/chekDataAuth/checkChangePassword";

const router = express.Router();

router.post("/deletion-request", verifyAuth, accountDeletionRequestController);
router.get("/billing-account", verifyAuth, billingAccountStatusController);
router.post("/change-password", verifyAuth, checkChangePassword, changePasswordController);

export default router;
