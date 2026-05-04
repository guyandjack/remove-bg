import { createClient } from "pexels";
import fs from "fs/promises";
import path from "path";

const pexelsConnect = async () => {
  const envValue = process.env.PEXELS_API_KEY;
  if (!envValue) {
    throw new Error("PEXELS_API_KEY is missing in .env");
  }

  // New setup: PEXELS_API_KEY contains the actual API key.
  // Backward-compat: if it still contains a file path, read the key from that file.
  const trimmedEnvValue = envValue.trim();
  let apiKey: string;
  try {
    const resolvedPath = path.resolve(trimmedEnvValue);
    const rawKey = await fs.readFile(resolvedPath, "utf8");
    apiKey = rawKey.trim();
  } catch {
    apiKey = trimmedEnvValue;
  }

  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is empty or invalid");
  }

  return createClient(apiKey);
};

export { pexelsConnect };
