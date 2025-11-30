import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

// Import the Express app using the path alias
import app from "@server"; 

logger.info("[Functions Init] Firebase Function loading start.");

setGlobalOptions({ maxInstances: 10 });

// Expose the Express app as a Firebase Function
export const api = onRequest((req, res) => {
  logger.info(`[Functions Request] Received request for ${req.path}`);
  try {
    // Pass the request and response to the imported Express app
    app(req, res);
  } catch (handlerError: any) { // Explicitly type handlerError
    logger.error("[Functions Request] Uncaught error in Express app handler:", handlerError);
    if (!res.headersSent) {
      res.status(500).send("Unhandled server error.");
    }
  }
});

logger.info("[Functions Init] Firebase Function loading complete. App exported.");
