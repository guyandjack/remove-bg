// scripts/generate-rsa-keys.mjs
import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";

const keysDir = path.resolve("keys");
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir);
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096, // taille solide
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

fs.writeFileSync(path.join(keysDir, "jwt_private_key.key"), privateKey, {
  mode: 0o600,
});
fs.writeFileSync(path.join(keysDir, "jwt_public_key.key"), publicKey);

console.log("✅ Clés générées dans le dossier ./keys :");
console.log(" - private.key (à garder secrète)");
console.log(" - public.key (peut être partagée aux autres services)");
