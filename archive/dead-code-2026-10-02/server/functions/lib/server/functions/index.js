import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { appPromise } from "../index"; // Import the async app factory
// Export the 'api' function which matches your firebase.json rewrites
export const api = onRequest({
    // Define secrets required by this function
    secrets: ["DATABASE_URL", "SESSION_SECRET"],
    // Adjust memory/timeout as needed
    memory: "512MiB",
    timeoutSeconds: 60,
    // Ensure we are in the same region as your DB/Storage if possible
    region: "us-central1"
}, async (req, res) => {
    try {
        // Use logger to trace initialization
        // We only log this once per cold start roughly
        if (!global.hasLoggedInit) {
            logger.info("Initializing Express app for request (Cold Start)");
            global.hasLoggedInit = true;
        }
        const app = await appPromise;
        // Forward the request to Express
        // Note: appPromise returns the configured express app instance
        app(req, res);
    }
    catch (error) {
        // Catch fatal errors that happen BEFORE Express can handle them
        logger.error("Failed to initialize Express app", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            message: "Internal Server Error: Application failed to start.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});
//# sourceMappingURL=index.js.map