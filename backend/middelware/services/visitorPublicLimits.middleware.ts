import { validateImageUpload } from "../checkDataUpload/checkDataUpload.js";
import { planOption } from "../../data/planOption.js";

const MB = 1024 * 1024;
const DEFAULT_VISITOR_MAX_BYTES = 5 * MB;

function parseSizeMaxToBytes(sizeMax: unknown): number | null {
  if (typeof sizeMax !== "string") return null;
  const trimmed = sizeMax.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(mb|m)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * MB);
}

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const validateVisitorImageUpload = validateImageUpload("file", {
  maxSizeBytes:
    parseSizeMaxToBytes(planOption.find((p) => p.name === "visitor")?.size_max) ??
    DEFAULT_VISITOR_MAX_BYTES,
  allowedMimes,
});

export { validateVisitorImageUpload };

