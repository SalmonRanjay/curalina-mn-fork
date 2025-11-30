import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { z } from "zod";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(), // Optional phone number
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function getSession() {
  console.log("[Auth] Attempting to get session configuration...");
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  if (!process.env.DATABASE_URL) {
    console.error("[Auth] ERROR: DATABASE_URL is not set!");
    throw new Error("DATABASE_URL is not configured for session store.");
  }

  let pgStore;
  try {
    pgStore = connectPg(session);
    console.log("[Auth] Initialized connect-pg-simple.");
  } catch (err) {
    console.error("[Auth] ERROR: Failed to initialize connect-pg-simple:", err);
    throw err;
  }

  let sessionStore;
  try {
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    console.log("[Auth] Initialized pg session store.");
  } catch (err) {
    console.error("[Auth] ERROR: Failed to create pg session store instance:", err);
    throw err;
  }

  if (!process.env.SESSION_SECRET) {
    console.error("[Auth] ERROR: SESSION_SECRET is not set!");
    throw new Error("SESSION_SECRET is not configured.");
  }

  console.log("[Auth] Returning session middleware.");
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  console.log("[Auth] Setting up authentication middleware...");
  try {
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());
    console.log("[Auth] Passport and session middleware applied.");
  } catch (err) {
    console.error("[Auth] ERROR: Failed to apply session or passport middleware:", err);
    throw err;
  }

  // Configure passport-local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          console.error("[Auth] LocalStrategy error:", error);
          return done(error);
        }
      }
    )
  );
  console.log("[Auth] LocalStrategy configured.");

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  console.log("[Auth] serializeUser configured.");

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found - session is stale, return false to clear it
        console.warn(`[Auth] User with ID ${id} not found during deserialize. Clearing session.`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("[Auth] deserializeUser error:", error);
      done(error);
    }
  });
  console.log("[Auth] deserializeUser configured.");

  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("[Auth] /api/auth/register invoked.");
      // Validate request body with Zod
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error("[Auth] Registration validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const { email, password, firstName, lastName, phoneNumber } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.warn(`[Auth] Registration: Email ${email} already registered.`);
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        role: "user",
      });
      console.log(`[Auth] User ${user.email} created.`);

      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("[Auth] Session regeneration error:", err);
          return res.status(500).json({ message: "Registration successful but session creation failed" });
        }

        // Log the user in
        req.login(user, (err) => {
          if (err) {
            console.error("[Auth] Login after registration failed:", err);
            return res.status(500).json({ message: "Registration successful but login failed" });
          }
          console.log(`[Auth] User ${user.email} logged in after registration.`);
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          });
        });
      });
    } catch (error) {
      console.error("[Auth] Top-level Registration error:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    console.log("[Auth] /api/auth/login invoked.");
    // Validate request body with Zod
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error("[Auth] Login validation failed:", validationResult.error.errors);
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validationResult.error.errors 
      });
    }

    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        console.error("[Auth] Passport authentication error:", err);
        return res.status(500).json({ message: "Authentication error" });
      }
      
      if (!user) {
        console.warn(`[Auth] Login failed: ${info?.message || "Invalid credentials"}`);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("[Auth] Session regeneration error after login:", err);
          return res.status(500).json({ message: "Session creation failed" });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("[Auth] Login failed after session regeneration:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          console.log(`[Auth] User ${user.email} logged in.`);
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          });
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    console.log("[Auth] /api/auth/logout invoked.");
    req.logout((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      // Destroy session to fully clear user data and prevent session fixation
      req.session.destroy((err) => {
        if (err) {
          console.error("[Auth] Session destruction error:", err);
          return res.status(500).json({ message: "Session destruction failed" });
        }
        
        // Clear session cookie
        res.clearCookie("connect.sid");
        console.log("[Auth] User logged out successfully.");
        res.json({ message: "Logged out successfully" });
      });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  console.log("[Auth] isAuthenticated middleware invoked.");
  if (req.isAuthenticated()) {
    console.log("[Auth] User is authenticated.");
    return next();
  }
  console.warn("[Auth] User is NOT authenticated. Sending 401.");
  res.status(401).json({ message: "Unauthorized" });
};