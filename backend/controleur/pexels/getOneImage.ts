//import des types
import type { RequestHandler } from "express";

//import des fonctions
import { pexelsConnect } from "../../function/pexelsConnect.js";
import { buildPexelsCroppedImageUrl } from "../../function/pexelsImageUrl.js";

const getOneImage: RequestHandler = async (req, res) => {
  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const idImg = typeof rawId === "string" ? Number(rawId) : Number.NaN;

  if (!Number.isFinite(idImg) || idImg <= 0) {
    return res.status(400).json("error HTTP code: pex-3 (invalid id)");
  }

  try {
    const client = await pexelsConnect();
    const response = await client.photos.show({ id: idImg });

    if (!response || !("src" in response)) {
      return res.status(500).json("error HTTP code: pex-3");
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
    console.log("error:", error?.message || error);

    res.status(500).json("error server code: pex-4 " + error);
  }
};

export { getOneImage };
