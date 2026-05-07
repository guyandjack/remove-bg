import crypto from "crypto";

const secretSalt = crypto.randomBytes(32).toString("hex");
console.log(secretSalt);
