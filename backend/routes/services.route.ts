//import deslibrairies
import express from "express";
import { verifyAuth } from "../middelware/verifAuth/verifyAuth.js";

//import des midelware de validation
import {
  validateConverterUpload,
  validateConverterOptions,
} from "../middelware/services/imageConverter.middleware.js";
import { parseSocialPicturePayload } from "../middelware/services/socialPicture.middleware.js";

//import des controleur
import { imageConverter } from "../controleur/services/imageConverter.controler.js";
import { formatSocialPictures } from "../controleur/services/socialFormatter.controler.js";
import { removeBg } from "../controleur/services/removeBg.controler.js";
import { removeBgByReplicate } from "../controleur/services/removeBgByReplicate.controler.js";
import { magicEraser } from "../controleur/services/magicEraser.controler.js";
import {
  attachRemoveBgQuality,
  validateRemoveBgUpload,
} from "../middelware/services/removeBg.middelware.js";
import {
  validateMagicEraserPayload,
} from "../middelware/services/magicEraser.middleware.js";

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
  verifyAuth,
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  removeBgByReplicate
);


//route magiceraser via replicate (MVP)
router.post(
  "/magic-eraser",
  verifyAuth,
  validateMagicEraserPayload,
  magicEraser
);


export default router;
