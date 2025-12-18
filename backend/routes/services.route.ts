import express from "express";
import { imageConverter } from "../controleur/services/imageConverter.controler";
import {
  validateConverterUpload,
  validateConverterOptions,
} from "../middelware/services/imageConverter.middleware";

const router = express.Router();

router.post(
  "/image-converter",
  validateConverterUpload,
  validateConverterOptions,
  imageConverter
);
//router.post("/image-social", imageSocial );
//router.post("/remove-bg", authMe, removeBg );
//router.post("/remove-bg", authMe, productShowcase );

export default router;
