import express from "express";

import { formatSocialPictures } from "../controleur/services/socialFormatter.controler";
import { parseSocialPicturePayload } from "../middelware/services/socialPicture.middleware";

const router = express.Router();

router.post("/pictures", parseSocialPicturePayload, formatSocialPictures);

export default router;
