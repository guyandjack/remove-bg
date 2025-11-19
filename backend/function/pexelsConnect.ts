import { createClient } from "pexels";
import fs from "fs/promises";
import path from "path";


const pexelsConnect = async () => {
  const apiKeyPath = process.env.PEXELS_API_KEY;

  if (!apiKeyPath) {
    throw new Error("PEXELS_API_KEY path is missing in .env");
  }

  // Résout le chemin vers ton fichier `.key`
  const resolvedPath = path.resolve(apiKeyPath);

  // Lecture réelle du fichier contenant la clé
  const rawKey = await fs.readFile(resolvedPath, "utf8");

  // Nettoyage (retours à la ligne / espaces)
  const apiKey = rawKey.trim();

  if (!apiKey) {
    throw new Error("PEXELS API key file is empty or invalid");
  }

  // Création du client Pexels
  const client = createClient(apiKey);

  return client;
};

export { pexelsConnect };
