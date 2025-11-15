import express from "express";
//import des controlleur
import { getImages } from "../controleur/pexels/getImages";
import { getOneImage } from "../controleur/pexels/getOneImage";

//import des middelware
import { pexelsCheckReqParams } from "../middelware/checkReqParams/pexelsCheckReqParams";

const router = express.Router();

router.get("/images/",pexelsCheckReqParams, getImages);
router.get("/image/", pexelsCheckReqParams, getOneImage);


export default router;
