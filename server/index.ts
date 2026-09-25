import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import dotenv from "dotenv";
import * as logger from "firebase-functions/logger";
import cors from "cors";
import path from "path";
import { isAiServicesEnabled } from "./services/ai-adapter/index.js";
import { startRenderReconciler } from "./services/ai-adapter/render-reconciler.js";
import { curalinaStorage } from "./storage-curalina";

// Export a factory function instead of a running promise
// This prevents side-effects (like DB connection) from happening at import time
export const createApp = async () => {
  // Load environment variables for local development only
  if (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_CONFIG) {
    dotenv.config();
  }

  logger.info("[Server Init] Starting Express app initialization...");
  const app = express();

  // Enable CORS for all routes
  app.use(cors({ origin: true }));

  // Middleware setup
  // IMPORTANT: Skip body parsing for multipart requests so multer can handle them
  app.use((req, res, next) => {
    if (req.is('multipart/form-data')) {
      next();
    } else {
      express.json({
        verify: (req, _res, buf) => {
          (req as any).rawBody = buf;
        }
      })(req, res, (err) => {
        if (err) return next(err);
        express.urlencoded({ extended: false })(req, res, next);
      });
    }
  });

  // In Firebase Hosting, static files are served by the CDN, not Express.
  // When running as a standalone container (e.g. Docker Compose), Express
  // must serve the Vite build output itself: `vite build` writes it to
  // dist/public relative to the project root, which is also process.cwd()
  // for the bundled dist/index.js started via `npm start`.
  app.use(express.static(path.join(process.cwd(), "dist", "public")));

  // Enhanced request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path; // Use req.path after potential rewrites
    let capturedJsonResponse: any = undefined;

    // Monkey-patch res.json to capture response body for logging
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) { // Only log API requests
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
        } else if (res.statusCode >= 400) {
            logger.warn(`[Request Warn] ${req.method} ${path}`, logData);
        } else {
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

  // SPA fallback for standalone (non-CDN) deployments: any non-API GET that
  // didn't match a static file or API route falls through to index.html so
  // client-side routing (wouter/react-router) can take over.
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(process.cwd(), "dist", "public", "index.html"));
  });

  // Central Error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
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
}; // <-- make sure createApp ends here

const PORT = Number(process.env.PORT) || 8080;

// Start the server when running in Cloud Run (K_SERVICE is set by Cloud Run)
const isCloudRun = !!process.env.K_SERVICE;

if (isCloudRun || process.env.NODE_ENV === "production") {
  createApp()
    .then((app) => {
      app.listen(PORT, "0.0.0.0", () => {
        logger.info(`[Server] Listening on port ${PORT}`);
        // ADR-0018 D6: app-side reconciler, only when AI services are on.
        if (isAiServicesEnabled()) {
          startRenderReconciler(curalinaStorage);
          logger.info("[Server] Render reconciler started");
        }
      });
    })
    .catch((error) => {
      logger.error("[Server Init] Critical startup error:", error);
      process.exit(1);
    });
}
