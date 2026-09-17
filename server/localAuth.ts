import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { getDbPool } from "./db"; // IMPORT THE POOL HELPER
import type { User } from "@shared/schema";
import { z } from "zod";

// Validation schemas (kept same as before)
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use the pool from db.ts which handles the connection string logic
  const pgPool = getDbPool();
  
  const PgSession = connectPg(session);
  
  const sessionStore = new PgSession({
    pool: pgPool, // Use the existing pool instead of creating a new one with conString
    createTableIfMissing: false, // Should be created via migration script ideally
    ttl: sessionTtl / 1000, // connect-pg-simple expects seconds
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || "default_dev_secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // "auto" resolves per-request via `req.secure`, which respects
      // `trust proxy` (set below) against X-Forwarded-Proto. So this is
      // still a real Secure cookie behind Firebase's HTTPS-terminating
      // load balancer in production, but correctly non-secure when
      // testing over plain HTTP (e.g. local `docker compose up`) —
      // `secure: NODE_ENV === "production"` silently dropped every
      // session cookie in that case regardless of NODE_ENV, since the
      // browser refuses to store a Secure cookie set over HTTP.
      secure: "auto",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1); // Trust Firebase Load Balancer
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid credentials" });
          
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) return done(null, false, { message: "Invalid credentials" });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  // Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ errors: result.error.errors });

      const { email, password, firstName, lastName, phoneNumber } = result.data;
      if (await storage.getUserByEmail(email)) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email, password: hashedPassword, firstName, lastName, phoneNumber, role: "user"
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profileImageUrl: user.profileImageUrl,
        });
      });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });

    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return res.status(500).json({ message: "Auth error" });
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            profileImageUrl: user.profileImageUrl,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
