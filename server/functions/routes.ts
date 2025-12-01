import { type Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { users, cartItems } from "@db/schema.js";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


// Extend Request to include session
interface RequestWithUser extends Request {
  session: {
    userId?: number;
    destroy: (callback: (err: any) => void) => void;
  } & Express.Request["session"];
}

// Authentication middleware
export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sessionReq = req as RequestWithUser;
  if (!sessionReq.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export async function registerRoutes(app: Express) {
  // ============================================
  // AUTH ROUTES (NO /api prefix!)
  // ============================================

  // Get current user
  app.get("/auth/user", async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    
    if (!sessionReq.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, sessionReq.session.userId),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Login
  app.post("/auth/login", async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      sessionReq.session.userId = user.id;
      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Register
  app.post("/auth/register", async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          name: name || email.split("@")[0],
        })
        .returning();

      sessionReq.session.userId = newUser.id;
      return res.json({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Logout
  app.post("/auth/logout", (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    
    sessionReq.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out successfully" });
    });
  });

  // ============================================
  // CART ROUTES
  // ============================================

  // Get cart items
  app.get("/cart", isAuthenticated, async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;

    try {
      const items = await db.query.cartItems.findMany({
        where: eq(cartItems.userId, sessionReq.session.userId!),
      });
      return res.json(items);
    } catch (error) {
      console.error("Get cart error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Add to cart
  app.post("/cart", isAuthenticated, async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID required" });
    }

    try {
      const [item] = await db
        .insert(cartItems)
        .values({
          userId: sessionReq.session.userId!,
          productId,
          quantity: quantity || 1,
        })
        .returning();

      return res.json(item);
    } catch (error) {
      console.error("Add to cart error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Remove from cart
  app.delete("/cart/:id", isAuthenticated, async (req: Request, res: Response) => {
    const sessionReq = req as RequestWithUser;
    const itemId = parseInt(req.params.id);

    if (isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    try {
      await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.id, itemId),
            eq(cartItems.userId, sessionReq.session.userId!)
          )
        );

      return res.json({ message: "Item removed" });
    } catch (error) {
      console.error("Remove from cart error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ============================================
  // UPLOAD ROUTE
  // ============================================

  app.post("/upload", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { fileName, contentType } = req.body;

      if (!fileName || !contentType) {
        return res.status(400).json({
          message: "fileName and contentType are required",
        });
      }

      // Check AWS credentials
      if (
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY ||
        !process.env.AWS_REGION ||
        !process.env.AWS_S3_BUCKET
      ) {
        console.error("Missing AWS configuration:", {
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          hasRegion: !!process.env.AWS_REGION,
          hasBucket: !!process.env.AWS_S3_BUCKET,
        });
        return res.status(500).json({
          message: "Server configuration error - AWS not configured",
        });
      }

     const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });


      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const key = `uploads/${timestamp}-${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });


      return res.json({
        method: "PUT",
        url,
        headers: {
          "Content-Type": contentType,
        },
        key,
      });
    } catch (error: any) {
      console.error("Upload error:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });

      return res.status(500).json({
        message: "Failed to generate upload URL",
        error: error.message,
      });
    }
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}