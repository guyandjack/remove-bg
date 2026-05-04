/// <reference types="node" />

import "dotenv/config";
import { createPool, type Pool } from "mysql2/promise";

// -----------------------------
// Connexion / Déconnexion
// -----------------------------

// -------------------------
// Variables d'environnement
// -------------------------
let env = process.env.NODE_ENV;
let host = "";
let user = "";
let password = "";
let database = "";
switch (env) {
  case "development":
    host = process.env.DB_HOST_DEV;
    user = process.env.DB_USER_DEV;
    password = process.env.DB_PASSWORD_DEV;
    database = process.env.DB_NAME_DEV;

    break;
  case "preprod":
    host = process.env.DB_HOST_PRE_PROD;
    user = process.env.DB_USER_PRE_PROD;
    password = process.env.DB_PASSWORD_PRE_PROD;
    database = process.env.DB_NAME_PRE_PROD;

    break;
  case "production":
    host = process.env.DB_HOST_PRODUCTION;
    user = process.env.DB_USER_PRODUCTION;
    password = process.env.DB_PASSWORD_PRODUCTION;
    database = process.env.DB_NAME_PRODUCTION;

    break;

  default:
    break;
}

// -------------------------
// Pool de connexion
// -------------------------
let pool: Pool | null = null;

/**
 * Connexion à la base de données (singleton)
 */
export async function connectDb(): Promise<Pool> {
  if (pool) return pool; // déjà connecté

  if (!host || !user || !database || !password) {
    throw new Error("❌ Variables d'environnement DB manquantes");
  }

  pool = createPool({
    host,
    user,
    password,
    database,
    connectionLimit: 10,
  });

  console.log(`✅ Connecté à la base ${database} de ${env}`);
  return pool;
}

/**
 * Ferme proprement la connexion
 */
export async function disconnectDb() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("🧹 Connexion MySQL fermée");
  }
}
