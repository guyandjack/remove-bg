//import deslibrairies
import express from "express";

//import des midelware de validation
import {
  validateConverterUpload,
  validateConverterOptions,
} from "../middelware/services/imageConverter.middleware";
import { parseSocialPicturePayload } from "../middelware/services/socialPicture.middleware";

//import des controleur
import { imageConverter } from "../controleur/services/imageConverter.controler";
import { formatSocialPictures } from "../controleur/services/socialFormatter.controler";

const router = express.Router();


//route image converter
router.post(
  "/image-converter",
  validateConverterUpload,
  validateConverterOptions,
  imageConverter
);

//route image social
router.post("/image-social", parseSocialPicturePayload, formatSocialPictures);


//router.post("/remove-bg", authMe, removeBg );
//router.post("/remove-bg", authMe, productShowcase );

export default router;
