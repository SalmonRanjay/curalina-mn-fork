import express from "express";
import { registerRoutes } from "./routes";
import dotenv from "dotenv";
import * as logger from "firebase-functions/logger";
// Create a promise that resolves with the fully configured Express app.
export const appPromise = (async () => {
    // Load environment variables for local development only
    if (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_CONFIG) {
        dotenv.config();
    }
    logger.info("[Server Init] Starting Express app initialization...");
    const app = express();
    // Middleware setup
    app.use(express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        }
    }));
    app.use(express.urlencoded({ extended: false }));
    // In Firebase Hosting, static files are served by the CDN, not Express.
    // But strictly for local dev or fallback, we can keep this:
    app.use(express.static("public"));
    // Enhanced request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();
        const path = req.path;
        let capturedJsonResponse = undefined;
        // Monkey-patch res.json to capture response body for logging
        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
            capturedJsonResponse = bodyJson;
            return originalResJson.apply(res, [bodyJson, ...args]);
        };
        res.on("finish", () => {
            const duration = Date.now() - start;
            if (path.startsWith("/api")) {
                const logData = {
                    method: req.method,
                    path: path,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    responseBody: capturedJsonResponse ? JSON.stringify(capturedJsonResponse).substring(0, 200) : undefined // Truncate
                };
                // Log at appropriate level based on status code
                if (res.statusCode >= 500) {
                    logger.error(`[Request Error] ${req.method} ${path}`, logData);
                }
                else if (res.statusCode >= 400) {
                    logger.warn(`[Request Warn] ${req.method} ${path}`, logData);
                }
                else {
                    logger.info(`[Request Info] ${req.method} ${path}`, logData);
                }
            }
        });
        next();
    });
    logger.info("[Server Init] Registering routes...");
    // registerRoutes handles Auth, API, Storage routes
    await registerRoutes(app);
    logger.info("[Server Init] Routes registered successfully.");
    // Central Error handling middleware
    app.use((err, req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        // Log full error details to Firebase Logger
        logger.error("[Express Error]", {
            status,
            message,
            path: req.path,
            method: req.method,
            stack: err.stack,
            // Include any custom properties if available on err object
            details: err.details || undefined
        });
        // Return JSON response to client
        if (!res.headersSent) {
            res.status(status).json({
                message,
                // Only include stack trace in development
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    });
    return app;
})();
// Helper to start server LOCALLY (not in Firebase)
// We check for FIREBASE_CONFIG to know if we are in the cloud function env
if (process.env.NODE_ENV === 'development' && !process.env.FIREBASE_CONFIG) {
    const PORT = process.env.PORT || 3001;
    appPromise.then(app => {
        app.listen(PORT, () => {
            logger.info(`[Server] Development server running on http://localhost:${PORT}`);
        });
    }).catch(error => {
        logger.error("[Server Init] Critical error during local startup:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map