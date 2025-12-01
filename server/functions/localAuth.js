"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = void 0;
exports.getSession = getSession;
exports.setupAuth = setupAuth;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const storage_js_1 = require("./storage.js");
const db_js_1 = require("./db.js"); // IMPORT THE POOL HELPER
const zod_1 = require("zod");
// Validation schemas (kept same as before)
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    phoneNumber: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
});
function getSession() {
    const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
    // Use the pool from db.ts which handles the connection string logic
    const pgPool = (0, db_js_1.getDbPool)();
    const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
    const sessionStore = new PgSession({
        pool: pgPool, // Use the existing pool instead of creating a new one with conString
        createTableIfMissing: false, // Should be created via migration script ideally
        ttl: sessionTtl / 1000, // connect-pg-simple expects seconds
        tableName: "sessions",
    });
    return (0, express_session_1.default)({
        secret: process.env.SESSION_SECRET || "default_dev_secret",
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            // Secure cookies require HTTPS. Firebase Functions runs on HTTPS.
            // In local dev (http), we might want secure: false.
            secure: process.env.NODE_ENV === "production",
            maxAge: sessionTtl,
        },
    });
}
async function setupAuth(app) {
    app.set("trust proxy", 1); // Trust Firebase Load Balancer
    app.use(getSession());
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    passport_1.default.use(new passport_local_1.Strategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
        try {
            const user = await storage_js_1.storage.getUserByEmail(email);
            if (!user)
                return done(null, false, { message: "Invalid credentials" });
            const isValid = await bcryptjs_1.default.compare(password, user.password);
            if (!isValid)
                return done(null, false, { message: "Invalid credentials" });
            return done(null, user);
        }
        catch (error) {
            return done(error);
        }
    }));
    passport_1.default.serializeUser((user, done) => done(null, user.id));
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const user = await storage_js_1.storage.getUser(id);
            done(null, user || false);
        }
        catch (error) {
            done(error);
        }
    });
    // Routes
    app.post("/auth/register", async (req, res) => {
        try {
            const result = registerSchema.safeParse(req.body);
            if (!result.success)
                return res.status(400).json({ errors: result.error.errors });
            const { email, password, firstName, lastName, phoneNumber } = result.data;
            if (await storage_js_1.storage.getUserByEmail(email)) {
                return res.status(400).json({ message: "Email already exists" });
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const user = await storage_js_1.storage.createUser({
                email, password: hashedPassword, firstName, lastName, phoneNumber, role: "user"
            });
            req.login(user, (err) => {
                if (err)
                    return res.status(500).json({ message: "Login failed" });
                res.json({ id: user.id, email: user.email, role: user.role });
            });
        }
        catch (e) {
            res.status(500).json({ message: "Server error" });
        }
    });
    app.post("/auth/login", (req, res, next) => {
        const result = loginSchema.safeParse(req.body);
        if (!result.success)
            return res.status(400).json({ errors: result.error.errors });
        passport_1.default.authenticate("local", (err, user, info) => {
            if (err)
                return res.status(500).json({ message: "Auth error" });
            if (!user)
                return res.status(401).json({ message: (info === null || info === void 0 ? void 0 : info.message) || "Invalid credentials" });
            req.login(user, (err) => {
                if (err)
                    return res.status(500).json({ message: "Login failed" });
                res.json({
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                });
            });
        })(req, res, next);
    });
    app.post("/auth/logout", (req, res) => {
        req.logout(() => {
            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                res.json({ message: "Logged out" });
            });
        });
    });
}
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated())
        return next();
    res.status(401).json({ message: "Unauthorized" });
};
exports.isAuthenticated = isAuthenticated;
