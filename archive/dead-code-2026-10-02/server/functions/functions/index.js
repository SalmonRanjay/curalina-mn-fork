"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const index_js_1 = require("../index.js"); // Import the async app factory
// Export the 'api' function which matches your firebase.json rewrites
exports.api = (0, https_1.onRequest)({
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
        const app = await index_js_1.appPromise;
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
