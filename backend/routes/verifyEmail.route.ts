import express from "express";
//import des middelware de controle des donnöees utilisazeur
import {}
import { verifyEmailCodeController } from "../middelware/checkUserEmailValid/emailVerification.ts";

const router = express.Router();

router.get("/", verifyEmailCodeController);

export default router;

