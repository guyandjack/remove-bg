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
import { createRemoveBgReplicateJob } from "../controleur/services/removeBgReplicateJobs.controler.js";
import { getRemoveBgReplicateJob } from "../controleur/services/getRemoveBgReplicateJob.controller.js";
import { streamRemoveBgReplicateJobEvents } from "../controleur/services/removeBgReplicateJobEvents.controller.js";
import { magicEraser } from "../controleur/services/magicEraser.controler.js";
import { removeBgVisitorByReplicate } from "../controleur/services/removeBgVisitorByReplicate.controler.js";
import { imageConverterVisitor } from "../controleur/services/imageConverterVisitor.controler.js";
import {
  attachRemoveBgQuality,
  validateRemoveBgUpload,
} from "../middelware/services/removeBg.middelware.js";
import { validateVisitorImageUpload1Mb } from "../middelware/services/visitorPublicLimits.middleware.js";
import {
  validateMagicEraserPayload,
} from "../middelware/services/magicEraser.middleware.js";

const router = express.Router();


//route image converter
router.post(
  "/image-converter",
  verifyAuth,
  validateConverterUpload,
  validateConverterOptions,
  imageConverter
);

// Public (no auth) - anti abuse visitors: 1MB max, quota server-side by hashed IP.
router.post(
  "/public/image-converter",
  validateVisitorImageUpload1Mb,
  validateConverterOptions,
  imageConverterVisitor,
);

//route image social
router.post("/image-social", parseSocialPicturePayload, formatSocialPictures);
router.post(
  "/remove-bg",
  verifyAuth,
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  removeBg
);

// Public (no auth) - anti abuse visitors: 1MB max, 1 trial total.
router.post(
  "/public/remove-bg",
  validateVisitorImageUpload1Mb,
  attachRemoveBgQuality,
  removeBgVisitorByReplicate,
);

// route remove bg via Replicate (MVP)
router.post(
  "/remove-bg-replicate",
  verifyAuth,
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  removeBgByReplicate
);

// route remove bg via Replicate (async job creation)
router.post(
  "/remove-bg-replicate/jobs",
  verifyAuth,
  validateRemoveBgUpload,
  attachRemoveBgQuality,
  createRemoveBgReplicateJob
);

router.get(
  "/remove-bg-replicate/jobs/:requestId",
  verifyAuth,
  getRemoveBgReplicateJob,
);

router.get(
  "/remove-bg-replicate/jobs/:requestId/events",
  verifyAuth,
  streamRemoveBgReplicateJobEvents,
);


//route magiceraser via replicate (MVP)
router.post(
  "/magic-eraser",
  verifyAuth,
  validateMagicEraserPayload,
  magicEraser
);


export default router;
