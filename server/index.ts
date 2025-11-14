import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve static files from public directory (including images)
app.use(express.static("public"));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start image health validation worker (runs every 6 hours)
    const IMAGE_HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    
    // Import worker asynchronously to avoid circular dependencies
    import("./routes-curalina").then(({ imageHealthWorker }) => {
      log(`[ImageHealthWorker] Starting scheduled validation (every 6 hours)`);
      
      // Run initial validation after 1 minute (give server time to fully start)
      setTimeout(async () => {
        try {
          log(`[ImageHealthWorker] Running initial validation`);
          const result = await imageHealthWorker.runValidation();
          log(`[ImageHealthWorker] Initial validation complete: ${result.processed} processed, ${result.updated} updated`);
        } catch (error: any) {
          log(`[ImageHealthWorker] Initial validation failed: ${error.message}`);
        }
      }, 60 * 1000);
      
      // Schedule recurring validation
      setInterval(async () => {
        try {
          log(`[ImageHealthWorker] Running scheduled validation`);
          const result = await imageHealthWorker.runValidation();
          log(`[ImageHealthWorker] Scheduled validation complete: ${result.processed} processed, ${result.updated} updated`);
        } catch (error: any) {
          log(`[ImageHealthWorker] Scheduled validation failed: ${error.message}`);
        }
      }, IMAGE_HEALTH_CHECK_INTERVAL);
    });
  });
})();
