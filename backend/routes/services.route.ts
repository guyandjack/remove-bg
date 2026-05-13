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
import { downloadRemoveBgReplicateJobOutput } from "../controleur/services/downloadRemoveBgReplicateJobOutput.controller.js";
import { deleteRemoveBgReplicateJobOutput } from "../controleur/services/deleteRemoveBgReplicateJobOutput.controller.js";
import { magicEraser } from "../controleur/services/magicEraser.controler.js";
import { removeBgVisitorByReplicate } from "../controleur/services/removeBgVisitorByReplicate.controler.js";
import { createRemoveBgVisitorReplicateJob } from "../controleur/services/removeBgVisitorReplicateJobs.controller.js";
import { getRemoveBgVisitorReplicateJob } from "../controleur/services/getRemoveBgVisitorReplicateJob.controller.js";
import { streamRemoveBgVisitorReplicateJobEvents } from "../controleur/services/removeBgVisitorReplicateJobEvents.controller.js";
import { downloadRemoveBgVisitorReplicateJobOutput } from "../controleur/services/downloadRemoveBgVisitorReplicateJobOutput.controller.js";
import { deleteRemoveBgVisitorReplicateJobOutput } from "../controleur/services/deleteRemoveBgVisitorReplicateJobOutput.controller.js";
import { imageConverterVisitor } from "../controleur/services/imageConverterVisitor.controler.js";
import {
  attachRemoveBgQuality,
  validateRemoveBgUpload,
} from "../middelware/services/removeBg.middelware.js";
import { validateVisitorImageUpload } from "../middelware/services/visitorPublicLimits.middleware.js";
import { limitRemoveBgInputMaxWidth } from "../middelware/services/resizeImageMaxWidth.middleware.js";
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

// Public (no auth) - anti abuse visitors: 5MB max, quota server-side by hashed IP.
router.post(
  "/public/image-converter",
  validateVisitorImageUpload,
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

// Public (no auth) - anti abuse visitors: 5MB max, quota server-side by hashed IP.
router.post(
  "/public/remove-bg",
  validateVisitorImageUpload,
  limitRemoveBgInputMaxWidth({ maxWidth: 1080 }),
  attachRemoveBgQuality,
  removeBgVisitorByReplicate,
);

// Public remove-bg via Replicate (async job creation + webhook + SSE)
router.post(
  "/public/remove-bg/jobs",
  validateVisitorImageUpload,
  limitRemoveBgInputMaxWidth({ maxWidth: 1080 }),
  attachRemoveBgQuality,
  createRemoveBgVisitorReplicateJob,
);

router.get(
  "/public/remove-bg/jobs/:requestId",
  getRemoveBgVisitorReplicateJob,
);

router.get(
  "/public/remove-bg/jobs/:requestId/events",
  streamRemoveBgVisitorReplicateJobEvents,
);

// One-shot download endpoint (deletes the optimized file after delivery).
router.get(
  "/public/remove-bg/jobs/:requestId/output",
  downloadRemoveBgVisitorReplicateJobOutput,
);
router.post(
  "/public/remove-bg/jobs/:requestId/output/delete",
  deleteRemoveBgVisitorReplicateJobOutput,
);

// route remove bg via Replicate (MVP)
router.post(
  "/remove-bg-replicate",
  verifyAuth,
  validateRemoveBgUpload,
  limitRemoveBgInputMaxWidth({ maxWidth: 1080 }),
  attachRemoveBgQuality,
  removeBgByReplicate
);

// route remove bg via Replicate (async job creation)
router.post(
  "/remove-bg-replicate/jobs",
  verifyAuth,
  validateRemoveBgUpload,
  limitRemoveBgInputMaxWidth({ maxWidth: 1080 }),
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

// One-shot download endpoint (deletes the optimized file after delivery).
// No auth header is required because browsers don't send Authorization on <img src>.
// Access is protected by an unguessable token embedded in the URL stored in DB.
router.get(
  "/remove-bg-replicate/jobs/:requestId/output",
  downloadRemoveBgReplicateJobOutput,
);
router.post(
  "/remove-bg-replicate/jobs/:requestId/output/delete",
  verifyAuth,
  deleteRemoveBgReplicateJobOutput,
);


//route magiceraser via replicate (MVP)
router.post(
  "/magic-eraser",
  verifyAuth,
  validateMagicEraserPayload,
  magicEraser
);


export default router;
