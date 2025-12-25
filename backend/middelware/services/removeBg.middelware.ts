import { validateImageUpload } from "../checkDataUpload/checkDataUpload";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const validateRemoveBgUpload = validateImageUpload("file", {
  maxSizeBytes: MAX_FILE_SIZE,
  allowedMimes,
});

export { validateRemoveBgUpload };
