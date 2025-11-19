import express from "express";
import { checkForgotPassword } from "../middelware/chekDataAuth/checkForgotPassword";
//import {} from "../controleur/loginDataUser.controler";

const router = express.Router();

router.post("/", checkForgotPassword, (req, res) => {
    return res.status(200).json({
        "status": "success",
        "message": "check data passed!"
    })
});

export default router;
