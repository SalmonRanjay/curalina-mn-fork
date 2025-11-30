import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import * as functions from "firebase-functions";

// Only load .env in development or if not in a Firebase Function environment
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

neonConfig.webSocketConstructor = ws;

let dbInstance: NeonDatabase<typeof schema> | null = null;
let poolInstance: Pool | null = null;

export const getDb = () => {
  if (dbInstance) {
    return dbInstance;
  }

  // PRIORITY:
  // 1. process.env.DATABASE_URL (Local dev or Firebase Secret injected as env var)
  // 2. functions.config().db.url (Legacy Firebase config)
  const connectionString = process.env.DATABASE_URL || functions.config().db?.url;

  if (!connectionString) {
    // We throw ONLY when requested, not at module load time.
    // This allows Firebase to analyze the file without crashing.
    throw new Error("DATABASE_URL is not set. Run 'firebase functions:secrets:set DATABASE_URL' or set it in .env");
  }

  poolInstance = new Pool({ connectionString });
  dbInstance = drizzle({ client: poolInstance, schema });
  return dbInstance;
};

// Helper to access the raw pool if needed (e.g. for session store)
export const getDbPool = () => {
  getDb(); // Ensure init
  if (!poolInstance) throw new Error("Database pool not initialized");
  return poolInstance;
};
