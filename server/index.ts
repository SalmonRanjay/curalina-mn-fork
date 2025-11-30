import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js"; // Add .js extension
// import { setupVite, serveStatic, log } from "./vite"; // Vite related imports are for local dev
// import { setupWebSocket } from "./webSocket"; // WebSocket is usually not directly supported in standard HTTP Cloud Functions
import dotenv from "dotenv";

// Load environment variables if not in a Firebase Functions environment
// In Firebase Functions, process.env variables are already available.
if (process.env.NODE_ENV !== "production" && !process.env.K_SERVICE) {
  dotenv.config();
}

console.info("[Server Init] Starting Express app initialization...");

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
// This might be handled differently in Firebase Hosting, but keep for API routes\' context.
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
        // Limit JSON log size to avoid hitting log limits and for readability
        const jsonString = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonString.substring(0, 150)}${jsonString.length > 150 ? "..." : ""}`;
      }

      if (logLine.length > 200) { // Further limit overall log line length
        logLine = logLine.substring(0, 199) + "…";
      }

      console.info(logLine);
    }
  });

  next();
});

// Register routes outside of the IIAFE
// registerRoutes returns a Promise<Server>, but in Functions we just need the app configured.
// We use .then() to ensure routes are registered asynchronously.
registerRoutes(app).catch((error: Error) => { // Explicitly type error as Error
  console.error("[Server Init] Error registering routes:", error);
  // You might want to crash the process or put the app in an error state here
  // For now, it will just log and continue, but routes might be unavailable.
});

// Error handling middleware - must be last app.use
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("[Express Error]", { status, message, stack: err.stack });
  res.status(status).json({ message });
});

console.info("[Server Init] Express app initialized and routes being registered.");

// Export the app for Firebase Functions
export default app;
