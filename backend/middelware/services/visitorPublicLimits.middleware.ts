import { validateImageUpload } from "../checkDataUpload/checkDataUpload.js";

const ONE_MB = 1 * 1024 * 1024;

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const validateVisitorImageUpload1Mb = validateImageUpload("file", {
  maxSizeBytes: ONE_MB,
  allowedMimes,
});

export { validateVisitorImageUpload1Mb };

