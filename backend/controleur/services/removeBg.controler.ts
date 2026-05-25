//import des librairies
import axios, { type AxiosError } from "axios";

//import de class
import FormData from "form-data";

//import de fonction
import { logger } from "../../logger.js";
import { getEnv } from "../../utils/getEnv.js";

//import des types
import type { RequestHandler } from "express";
import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";


const env = getEnv();
const urlServiceDev = process.env.SERVICE_URL_DEV || null;
const urlServiceProd = process.env.SERVICE_URL_PROD || null;

const serviceBaseUrl = env.env === "dev" ? urlServiceDev : urlServiceProd
  

const REQUEST_TIMEOUT =
  Number(process.env.REMOVE_BG_TIMEOUT_MS ?? "45000") || 45000;

const sanitizeFilename = (name: string) =>
  name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "image";

const removeBg: RequestHandler = async (req, res) => {

  if (!serviceBaseUrl) {
    logger.error("removeBg::missing_service_base_url", {
      code: "ctrl_removeBg_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      "satus": "error",
      "message": "erreur 500 variable env default",
      code: "ctrl_removeBg_err1",
    })
  };

  const image = (req as any).imageValidated as ValidatedImage | undefined;
  const quality = (req as any).removeBgOptions?.quality || "pro";

  if (!image) {
    logger.warn("removeBg::missing_validated_image", {
      code: "ctrl_removeBg_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(400).json({
      error: true,
      message: "Aucune image valide n'a ete detectee.",
      code: "ctrl_removeBg_err2",
      requestId: (req as any).requestId,
    });
  }

  try {
    const startedAt = Date.now();
    logger.info("removeBg::call_start", {
      quality,
      requestId: (req as any).requestId,
      serviceBaseUrl,
    });

    const formData = new FormData();
    formData.append("file", image.buffer, {
      filename: image.originalName,
      contentType: image.mime,
    });

    const response = await axios.post<ArrayBuffer>(
      `${serviceBaseUrl}/remove-bg`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: "arraybuffer",
        timeout: REQUEST_TIMEOUT,
        params: { quality },
      }
    );

    const filename = sanitizeFilename(image.originalName);
    const contentDisposition =
      response.headers["content-disposition"] ||
      `inline; filename="${filename}-bg-removed.png"`;
    const contentType = response.headers["content-type"] || "image/png";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);

    logger.info("removeBg::call_success", {
      quality,
      durationMs: Date.now() - startedAt,
      requestId: (req as any).requestId,
      headers: response.headers,
    });

    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status ?? 502;
    const detail =
      (axiosError.response?.data as any)?.detail ||
      axiosError.message ||
      "Service indisponible";

    logger.error("removeBg::call_failed", {
      code: "ctrl_removeBg_err3",
      status,
      detail,
      requestId: (req as any).requestId,
    });

    return res.status(status === 200 ? 500 : status).json({
      error: true,
      message:
        status >= 500
          ? "Le service de suppression de fond est indisponible pour le moment."
          : detail,
      code: "ctrl_removeBg_err3",
      requestId: (req as any).requestId,
    });
  }
};

export { removeBg };
