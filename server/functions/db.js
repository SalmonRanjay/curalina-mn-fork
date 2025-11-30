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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbPool = exports.getDb = void 0;
const serverless_1 = require("@neondatabase/serverless");
const neon_serverless_1 = require("drizzle-orm/neon-serverless");
const ws_1 = __importDefault(require("ws"));
const schema = __importStar(require("@shared/schema"));
const dotenv_1 = __importDefault(require("dotenv"));
const functions = __importStar(require("firebase-functions"));
// Only load .env in development or if not in a Firebase Function environment
if (process.env.NODE_ENV !== "production") {
    dotenv_1.default.config();
}
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
let dbInstance = null;
let poolInstance = null;
const getDb = () => {
    var _a;
    if (dbInstance) {
        return dbInstance;
    }
    // PRIORITY:
    // 1. process.env.DATABASE_URL (Local dev or Firebase Secret injected as env var)
    // 2. functions.config().db.url (Legacy Firebase config)
    const connectionString = process.env.DATABASE_URL || ((_a = functions.config().db) === null || _a === void 0 ? void 0 : _a.url);
    if (!connectionString) {
        // We throw ONLY when requested, not at module load time.
        // This allows Firebase to analyze the file without crashing.
        throw new Error("DATABASE_URL is not set. Run 'firebase functions:secrets:set DATABASE_URL' or set it in .env");
    }
    poolInstance = new serverless_1.Pool({ connectionString });
    dbInstance = (0, neon_serverless_1.drizzle)({ client: poolInstance, schema });
    return dbInstance;
};
exports.getDb = getDb;
// Helper to access the raw pool if needed (e.g. for session store)
const getDbPool = () => {
    (0, exports.getDb)(); // Ensure init
    if (!poolInstance)
        throw new Error("Database pool not initialized");
    return poolInstance;
};
exports.getDbPool = getDbPool;
