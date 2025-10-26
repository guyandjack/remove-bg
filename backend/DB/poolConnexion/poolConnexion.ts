import "dotenv/config";
import mysql, { Pool } from "mysql2/promise";



// -----------------------------
// Connexion / Déconnexion
// -----------------------------

// -------------------------
// Variables d'environnement
// -------------------------
const isDev = process.env.NODE_ENV === "development";

// En dev → variables locales (.env)
// En prod → tu peux définir d'autres variables dans ton hébergeur
const host = isDev ? process.env.DB_HOST_DEV : process.env.DB_HOST_PROD;
const user = isDev ? process.env.DB_USER_DEV : process.env.DB_USER_PROD;
const password = isDev ? process.env.DB_PASSWORD_DEV : process.env.DB_PASSWORD_PROD;
const database = isDev ? process.env.DB_NAME_DEV : process.env.DB_NAME_PROD;

// -------------------------
// Pool de connexion
// -------------------------
let pool: Pool | null = null;

/**
 * Connexion à la base de données (singleton)
 */
export async function connectDb(): Promise<Pool> {
  if (pool) return pool; // déjà connecté

  if (!host || !user || !database) {
    throw new Error("❌ Variables d'environnement DB manquantes");
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    connectionLimit: 10,
  });

  console.log(`✅ Connecté à la base ${database} (${isDev ? "DEV" : "PROD"})`);
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
