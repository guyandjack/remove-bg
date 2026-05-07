import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";
import {
  accountDeletionRequestController,
} from "../controleur/account/deletionRequest.controller.js";
import { billingAccountStatusController } from "../controleur/account/billingAccountStatus.controller.js";
import { changePasswordController } from "../controleur/account/changePassword.controller.js";
import { checkChangePassword } from "../middelware/chekDataAuth/checkChangePassword.js";
import { accountDeletionFeedbackController } from "../controleur/account/deletionFeedback.controller.js";
import { checkDataAccountDeletionFeedback } from "../middelware/checkDataAccountDeletionFeedback/checkDataAccountDeletionFeedback.js";

const router = express.Router();

router.post("/deletion-request", verifyAuth, accountDeletionRequestController);
router.post("/deletion-feedback", checkDataAccountDeletionFeedback, accountDeletionFeedbackController);
router.get("/billing-account", verifyAuth, billingAccountStatusController);
router.post("/change-password", verifyAuth, checkChangePassword, changePasswordController);

export default router;
