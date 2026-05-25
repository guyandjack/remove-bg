//import des types
import type { RequestHandler } from "express";

//import des fonctions
import { pexelsConnect } from "../../function/pexelsConnect.js";
import { buildPexelsCroppedImageUrl } from "../../function/pexelsImageUrl.js";
import { logger } from "../../logger.js";

const getOneImage: RequestHandler = async (req, res) => {
  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const idImg = typeof rawId === "string" ? Number(rawId) : Number.NaN;

  if (!Number.isFinite(idImg) || idImg <= 0) {
    logger.warn("pexels.getOneImage::invalid_id", {
      code: "ctrl_getOneImage_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(400).json({
      success: false,
      message: "error HTTP code: pex-3 (invalid id)",
      code: "ctrl_getOneImage_err1",
    });
  }

  try {
    const client = await pexelsConnect();
    const response = await client.photos.show({ id: idImg });

    if (!response || !("src" in response)) {
      logger.error("pexels.getOneImage::invalid_response", {
        code: "ctrl_getOneImage_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        id: idImg,
      });
      return res.status(500).json({
        success: false,
        message: "error HTTP code: pex-3",
        code: "ctrl_getOneImage_err2",
      });
    }

    // image 2000 x 2000
    const image2000 = buildPexelsCroppedImageUrl(response.src.original, {
      width: 2000,
      height: 2000,
    });

    res.status(200).json({
      ...response,
      customImage: image2000,
    });
  } catch (error: any) {
    logger.error("pexels.getOneImage::show_failed", {
      code: "ctrl_getOneImage_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      id: idImg,
      message: error?.message ?? String(error),
    });

    return res.status(500).json({
      success: false,
      message: "error server code: pex-4",
      code: "ctrl_getOneImage_err3",
    });
  }
};

export { getOneImage };
