import express from "express";
//import des controlleur
import { getImages } from "../controleur/pexels/getImages.js";
import { getOneImage } from "../controleur/pexels/getOneImage.js";

//import des middelware
import { pexelsCheckReqParams } from "../middelware/checkReqParams/pexelsCheckReqParams.js";

const router = express.Router();

router.get("/images/",pexelsCheckReqParams, getImages);
router.get("/image/", pexelsCheckReqParams, getOneImage);


export default router;
