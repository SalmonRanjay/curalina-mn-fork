import express, { Router, } from "express";
import { registerRoutes } from "./routes.js";
import dotenv from "dotenv";
import * as logger from "firebase-functions/logger";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import session from "express-session";
// Factory that builds the Express app (shared by local dev + Cloud Function)
export const createApp = async () => {
    // Load environment variables for local development only
    if (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_CONFIG) {
        dotenv.config();
    }
    logger.info("[Server Init] Starting Express app initialization...");
    const app = express();
    // Enable CORS for all routes
    app.use(cors({ origin: true, credentials: true }));
    // Use express-session middleware
    app.use(session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: process.env.NODE_ENV === "production" },
    }));
    // Body parsing
    // IMPORTANT: Skip JSON parsing ONLY for multipart requests
    app.use((req, res, next) => {
        if (req.is("multipart/form-data")) {
            // Let Cloud Functions / any multipart middleware handle this (if we ever add it)
            return next();
        }
        // JSON + urlencoded parsing
        express.json({
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            },
        })(req, res, (err) => {
            if (err)
                return next(err);
            express.urlencoded({ extended: false })(req, res, next);
        });
    });
    // (Optional) Static files for local dev only – Hosting serves static in prod
    if (process.env.NODE_ENV === "development" && !process.env.FIREBASE_CONFIG) {
        app.use(express.static("public"));
    }
    // Enhanced request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();
        const path = req.path;
        let capturedJsonResponse = undefined;
        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
            capturedJsonResponse = bodyJson;
            return originalResJson.apply(res, [bodyJson, ...args]);
        };
        res.on("finish", () => {
            const duration = Date.now() - start;
            // Only log API requests to avoid noise
            if (path.startsWith("/api") || path.startsWith("/auth") || path.startsWith("/my-dashboard")) {
                const logData = {
                    method: req.method,
                    path,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    responseBody: capturedJsonResponse
                        ? JSON.stringify(capturedJsonResponse).substring(0, 200)
                        : undefined,
                };
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
    // Use a Router so we can mount it under /api and /
    const router = Router();
    // IMPORTANT:
    // registerRoutes defines routes like "/auth/user", "/upload", "/my-dashboard/cart"
    // We attach them to the router instead of the root app
    await registerRoutes(router);
    // For Cloud Functions behind Firebase Hosting:
    // Requests come in as /api/... → we mount router at /api
    app.use("/api", router);
    // For direct Cloud Run URLs (api-*.run.app) and local dev:
    // They may hit without /api prefix → we also mount at root
    app.use("/", router);
    logger.info("[Server Init] Routes registered successfully.");
    // Central Error handling middleware
    app.use((err, req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        logger.error("[Express Error]", {
            status,
            message,
            path: req.path,
            method: req.method,
            stack: err.stack,
            details: err.details || undefined,
        });
        if (!res.headersSent) {
            res.status(status).json({
                message,
                stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
            });
        }
    });
    return app;
};
// ---------- Cloud Function export (GEN2) ----------
const appPromise = createApp();
// This is what Firebase sees as the "api" function
export const api = onRequest(async (req, res) => {
    const app = await appPromise;
    return app(req, res);
});
// ---------- Local dev server (not used in Cloud Functions) ----------
if (process.env.NODE_ENV === "development" && !process.env.FIREBASE_CONFIG) {
    const PORT = process.env.PORT || 3001;
    appPromise
        .then((app) => {
        app.listen(PORT, () => {
            logger.info(`[Server] Development server running on http://localhost:${PORT}`);
        });
    })
        .catch((error) => {
        logger.error("[Server Init] Critical error during local startup:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map