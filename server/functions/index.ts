import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Import the built application factory
// @ts-ignore - The file exists after build
import { createApp } from "./dist/index.js";

// Cache the app instance to reuse across requests (warm start)
let appInstance: any = null;

// Export the 'api' function which matches your firebase.json rewrites
export const api = onRequest(
  {
    // Define secrets required by this function
    secrets: ["DATABASE_URL", "SESSION_SECRET"],
    // Adjust memory/timeout as needed
    memory: "512MiB",
    timeoutSeconds: 60,
    // Ensure we are in the same region as your DB/Storage if possible
    region: "us-central1"
  },
  async (req, res) => {
    try {
      if (!appInstance) {
        logger.info("Initializing Express app for request (Cold Start)");
        appInstance = await createApp();
      }
      
      // Forward the request to Express
      appInstance(req, res);
    } catch (error: any) {
      // Catch fatal errors that happen BEFORE Express can handle them
      logger.error("Failed to initialize Express app", {
          message: error.message,
          stack: error.stack
      });
      
      // Send JSON error response
      res.status(500).json({ 
          message: "Internal Server Error: Application failed to start.",
          details: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);
