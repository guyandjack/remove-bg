import sharp from "sharp";
import JSZip from "jszip";
import type { RequestHandler } from "express";

import { logger } from "../../logger";
import type { SanitizedSocialAsset } from "../../middelware/services/socialPicture.middleware";

const extensionByFormat = {
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "avif",
} as const;

const slugifyName = (value?: string) =>
  (value || "image-social")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image-social";

const formatFilename = (asset: SanitizedSocialAsset) => {
  const baseSlug = slugifyName(asset.file.name);
  const suffix = asset.presetId ? `-${asset.presetId}` : "";
  const ext = extensionByFormat[asset.format];
  return `${baseSlug}${suffix}.${ext}`;
};

const formatAssetBuffer = async (asset: SanitizedSocialAsset) => {
  let pipeline = sharp(asset.file.data, { failOnError: false }).resize(
    asset.width,
    asset.height,
    {
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    }
  );

  switch (asset.format) {
    case "png":
      pipeline = pipeline.png({
        compressionLevel: 8,
        adaptiveFiltering: true,
      });
      break;
    case "webp":
      pipeline = pipeline.webp({
        quality: 90,
        smartSubsample: true,
      });
      break;
    case "avif":
      pipeline = pipeline.avif({
        quality: 85,
        effort: 3,
      });
      break;
    default:
      pipeline = pipeline.jpeg({
        quality: 92,
        mozjpeg: true,
        chromaSubsampling: "4:4:4",
      });
  }

  const buffer = await pipeline.toBuffer();
  return { buffer, filename: formatFilename(asset) };
};

const formatSocialPictures: RequestHandler = async (req, res) => {
  try {
    const assets = (req as any).socialAssets as SanitizedSocialAsset[] | undefined;
    if (!assets?.length) {
      return res.status(400).json({
        error: true,
        message: "Aucune image n'a ete fournie pour la mise au format.",
      });
    }

    const formattedBuffers = await Promise.all(
      assets.map(async (asset) => {
        const result = await formatAssetBuffer(asset);
        return {
          ...result,
          meta: {
            presetId: asset.presetId,
            width: asset.width,
            height: asset.height,
            network: asset.network,
            category: asset.category,
            ratio: asset.ratio,
          },
        };
      })
    );

    const zip = new JSZip();
    formattedBuffers.forEach((item) => {
      zip.file(item.filename, item.buffer);
    });
    zip.file(
      "manifest.json",
      JSON.stringify(
        formattedBuffers.map((item) => ({
          filename: item.filename,
          ...item.meta,
        })),
        null,
        2
      )
    );

    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    const archiveName = `social-pictures-${Date.now()}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archiveName}"`);
    res.setHeader("X-Asset-Count", String(formattedBuffers.length));
    return res.status(200).send(archive);
  } catch (error) {
    logger.error("Social picture formatting failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId: (req as any).requestId,
    });
    return res.status(500).json({
      error: true,
      message:
        "Impossible de traiter les images pour les reseaux sociaux pour le moment.",
      requestId: (req as any).requestId,
    });
  }
};

export { formatSocialPictures };
