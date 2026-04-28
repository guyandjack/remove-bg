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
import { removeBg } from "../controleur/services/removeBg.controler";
import { removeBgByReplicate } from "../controleur/services/removeBgByReplicate.controler";
import { magicEraser } from "../controleur/services/magicEraser.controler";
import {
  attachRemoveBgQuality,
  validateRemoveBgUpload,
} from "../middelware/services/removeBg.middelware";
import {
  validateMagicEraserPayload,
} from "../middelware/services/magicEraser.middleware";

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
router.post(
  "/remove-bg",
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  removeBg
);

// route remove bg via Replicate (MVP)
router.post(
  "/remove-bg-replicate",
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  removeBgByReplicate
);


//route magiceraser via replicate (MVP)
router.post(
  "/magic-eraser",
  validateMagicEraserPayload,
  magicEraser
);


export default router;
