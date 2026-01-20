import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage.js";
import { curalinaStorage } from "./storage-curalina";
import { setupAuth, isAuthenticated } from "./localAuth.js";
import {
  ObjectStorageService,
  ObjectNotFoundError
} from "./objectStorage.js";
import { ObjectPermission } from "./objectAcl.js";
import { insertContentSchema, insertSettingsSchema, insertQuizResponseSchema, insertRenderSchema, User } from "@shared/schema.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mappingAnalysisRoutes from "./routes-mapping-analysis.js";
import { registerCuralinaRoutes } from "./routes-curalina.js";

// Define a custom Request type that includes the user property
interface RequestWithUser extends Request {
  user?: User;
}

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Admin-only middleware
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  const user = (req as RequestWithUser).user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  return next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  const authUserHandler = async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = (req as RequestWithUser).user;
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  };

  // Legacy path
  app.get('/auth/user', isAuthenticated, authUserHandler);
  // Primary API path used by the frontend
  app.get('/api/auth/user', isAuthenticated, authUserHandler);

  // User profile routes
  app.put('/users/profile', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { firstName, lastName, bio } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.upsertUser({
        ...user,
        firstName: firstName ?? user.firstName,
        lastName: lastName ?? user.lastName,
        bio: bio ?? user.bio,
      });

      await storage.createActivityLog({
        userId,
        action: "profile_updated",
        description: "Updated profile information",
      });

      return res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Admin user management routes
  app.get('/admin/users', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/admin/users', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const createUserSchema = z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        role: z.enum(["user", "admin"]).default("user"),
      });

      const validatedData = createUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      await storage.createActivityLog({
        userId: (req as RequestWithUser).user!.id,
        action: "user_created",
        description: `Created new user: ${newUser.email}`,
        metadata: { createdUserId: newUser.id },
      });

      const { password, ...userWithoutPassword } = newUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating user:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/admin/users/:id', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      const updateUserSchema = z.object({
        email: z.string().email("Invalid email address").optional(),
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        role: z.enum(["user", "admin"]).optional(),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
      });

      const validatedData = updateUserSchema.parse(req.body);

      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailExists = await storage.getUserByEmail(validatedData.email);
        if (emailExists) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updates: Partial<User> & { password?: string } = {};
      if (validatedData.email) updates.email = validatedData.email;
      if (validatedData.firstName) updates.firstName = validatedData.firstName;
      if (validatedData.lastName) updates.lastName = validatedData.lastName;
      if (validatedData.role) updates.role = validatedData.role;
      if (validatedData.password) {
        updates.password = await bcrypt.hash(validatedData.password, 10);
      }

      const updatedUser = await storage.updateUser(id, updates);

      await storage.createActivityLog({
        userId: (req as RequestWithUser).user!.id,
        action: "user_updated",
        description: `Updated user: ${updatedUser.email}`,
        metadata: { updatedUserId: id, changes: Object.keys(updates) },
      });

      const { password, ...userWithoutPassword } = updatedUser;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/admin/users/:id', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;

      if (id === (req as RequestWithUser).user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteUser(id);

      await storage.createActivityLog({
        userId: (req as RequestWithUser).user!.id,
        action: "user_deleted",
        description: `Deleted user: ${existingUser.email}`,
        metadata: { deletedUserId: id },
      });

      return res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Content routes
  app.get('/content', async (req: Request, res: Response): Promise<Response> => {
    try {
      const items = await storage.getAllContent();
      return res.json(items);
    } catch (error) {
      console.error("Error fetching content:", error);
      return res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.get('/content/:id', async (req: Request, res: Response): Promise<Response> => {
    try {
      const item = await storage.getContent(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }
      return res.json(item);
    } catch (error) {
      console.error("Error fetching content:", error);
      return res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.post('/content', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const validatedData = insertContentSchema.parse({
        ...req.body,
        authorId: userId,
      });

      const item = await storage.createContent(validatedData);

      await storage.createActivityLog({
        userId,
        action: "content_created",
        description: `Created content: ${item.title}`,
        metadata: { contentId: item.id },
      });

      return res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating content:", error);
      return res.status(500).json({ message: "Failed to create content" });
    }
  });

  app.put('/content/:id', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { id } = req.params;

      const existing = await storage.getContent(id);
      if (!existing) {
        return res.status(404).json({ message: "Content not found" });
      }

      const item = await storage.updateContent(id, req.body);

      await storage.createActivityLog({
        userId,
        action: "content_updated",
        description: `Updated content: ${item.title}`,
        metadata: { contentId: item.id },
      });

      return res.json(item);
    } catch (error) {
      console.error("Error updating content:", error);
      return res.status(500).json({ message: "Failed to update content" });
    }
  });

  app.delete('/content/:id', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { id } = req.params;

      const existing = await storage.getContent(id);
      if (!existing) {
        return res.status(404).json({ message: "Content not found" });
      }

      await storage.deleteContent(id);

      await storage.createActivityLog({
        userId,
        action: "content_deleted",
        description: `Deleted content: ${existing.title}`,
        metadata: { contentId: id },
      });

      return res.json({ message: "Content deleted" });
    } catch (error) {
      console.error("Error deleting content:", error);
      return res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // Settings routes
  app.get('/settings', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const allSettings = await storage.getAllSettings();
      return res.json(allSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get('/settings/:key', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      return res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      return res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.put('/settings/:key', isAuthenticated, isAdmin, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const validatedData = insertSettingsSchema.parse({
        key: req.params.key,
        ...req.body,
      });

      const setting = await storage.upsertSetting(validatedData);

      await storage.createActivityLog({
        userId,
        action: "settings_updated",
        description: `Updated setting: ${setting.key}`,
        metadata: { settingKey: setting.key },
      });

      return res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating setting:", error);
      return res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Activity log routes
  app.get('/activity', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const user = await storage.getUser(userId);

      // Admins can see all activity, users can only see their own
      const logs = user?.role === "admin"
        ? await storage.getActivityLog()
        : await storage.getActivityLog(userId);

      return res.json(logs);
    } catch (error) {
      console.error("Error fetching activity log:", error);
      return res.status(500).json({ message: "Failed to fetch activity log" });
    }
  });

  // ===== USER DASHBOARD ROUTES =====
  app.get('/my-dashboard/stats', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const stats = await storage.getUserDashboardStats(userId);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // API-backed dashboard analytics and entities for the frontend
  app.get('/api/user/dashboard/analytics', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const stats = await storage.getUserDashboardStats(userId);
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      return res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  app.get('/api/user/dashboard/renders', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const renders = await storage.getUserRenders(userId);
      return res.json(renders);
    } catch (error) {
      console.error("Error fetching user renders:", error);
      return res.status(500).json({ message: "Failed to fetch user renders" });
    }
  });

  app.get('/api/user/dashboard/saved-designs', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const designs = await storage.getSavedDesigns(userId);
      return res.json(designs);
    } catch (error) {
      console.error("Error fetching saved designs:", error);
      return res.status(500).json({ message: "Failed to fetch saved designs" });
    }
  });

  app.post('/api/user/dashboard/saved-designs', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { renderId, title, notes } = req.body as { renderId?: string; title?: string; notes?: string };

      if (!renderId) {
        return res.status(400).json({ message: "renderId is required" });
      }

      try {
        const design = await storage.createSavedDesign({
          userId,
          renderId,
          title,
          notes,
          isPublic: false,
        } as any);
        return res.status(201).json(design);
      } catch (err: any) {
        // Unique constraint: user can only save a render once
        if (err && (err.code === '23505' || err.constraint === 'user_render_unique')) {
          return res.status(409).json({ message: "Design already saved" });
        }
        throw err;
      }
    } catch (error) {
      console.error("Error saving design:", error);
      return res.status(500).json({ message: "Failed to save design" });
    }
  });

  app.delete('/api/user/dashboard/saved-designs/:id', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { id } = req.params;

      await storage.deleteSavedDesign(id, userId);
      return res.json({ message: "Design removed" });
    } catch (error) {
      console.error("Error removing saved design:", error);
      return res.status(500).json({ message: "Failed to remove saved design" });
    }
  });

  app.get('/api/user/dashboard/orders', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const orders = await storage.getUserOrders(userId);
      return res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/user/dashboard/interactions', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const interactions = await storage.getUserProductInteractions(userId);
      return res.json(interactions);
    } catch (error) {
      console.error("Error fetching user interactions:", error);
      return res.status(500).json({ message: "Failed to fetch interactions" });
    }
  });

  // Cart routes (session-based)
  app.get("/cart", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const items = await storage.getUserCartItems(userId);
      return res.json(items);
    } catch (error) {
      console.error("Error fetching cart:", error);
      return res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  // Simple add-to-cart route for local dev; session/user based
  app.post("/cart", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { productId, quantity = 1 } = req.body as { productId: string; quantity?: number };

      const cartItem = await storage.addToCart({
        userId,
        productId,
        quantity,
      } as any);

      return res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      return res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  // Mirror cart routes under /api for frontend
  app.get("/api/cart", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const items = await storage.getUserCartItems(userId);
      return res.json(items);
    } catch (error) {
      console.error("Error fetching cart (API route):", error);
      return res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post("/api/cart", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { productId, quantity = 1 } = req.body as { productId: string; quantity?: number };

      const cartItem = await storage.addToCart({
        userId,
        productId,
        quantity,
      } as any);

      return res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart (API route):", error);
      return res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  // ... (other dashboard routes) ...

  // ===== FILE UPLOAD ROUTES =====

  // Legacy object storage upload URL generator
  app.post("/objects/upload", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    return res.json({ uploadURL });
  });

  // Also expose the upload URL generator under /api for frontend consistency
  app.post("/api/objects/upload", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    return res.json({ uploadURL });
  });

  // New multipart file upload route
  app.post("/upload", isAuthenticated, upload.single("file"), async (req: Request, res: Response): Promise<Response> => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // You might want to move the file to a permanent location, e.g., S3
    // For now, just return info about the uploaded file
    console.log("File uploaded:", req.file);
    return res.status(201).json({
      message: "File uploaded successfully",
      fileName: req.file.filename,
      path: req.file.path,
      // In a real app, you would return a public URL here
      url: `/uploads/${req.file.filename}`, 
    });
  });

  // Mirror multipart upload route under /api for Vite-proxied frontend
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: Request, res: Response): Promise<Response> => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log("File uploaded (API route):", req.file);
    return res.status(201).json({
      message: "File uploaded successfully",
      fileName: req.file.filename,
      path: req.file.path,
      url: `/uploads/${req.file.filename}`,
    });
  });

  // S3 Presigned URL Upload Route
  app.post("/upload/presigned", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const { fileName, contentType } = req.body as {
        fileName?: string;
        contentType?: string;
      };

      if (!fileName) {
        return res.status(400).json({ error: "fileName is required" });
      }

      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const key = `uploads/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

      return res.json({
        method: "PUT",
        url,
        headers: { "Content-Type": contentType || "application/octet-stream" },
        publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
      });
    } catch (err) {
      console.error("Presigned URL generation error:", err);
      return res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Mirror presigned URL route under /api for frontend
  app.post("/api/upload/presigned", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const { fileName, contentType } = req.body as {
        fileName?: string;
        contentType?: string;
      };

      if (!fileName) {
        return res.status(400).json({ error: "fileName is required" });
      }

      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const key = `uploads/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

      return res.json({
        method: "PUT",
        url,
        headers: { "Content-Type": contentType || "application/octet-stream" },
        publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
      });
    } catch (err) {
      console.error("Presigned URL generation error (API route):", err);
      return res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // ===== QUIZ & RENDER ROUTES (LOCAL DEV FRIENDLY) =====

  // Create a new quiz response
  app.post("/api/quiz", async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user?.id;
      const payload = {
        ...req.body,
        userId: userId ?? undefined,
      };

      const quizInput = insertQuizResponseSchema.parse(payload);
      const quiz = await curalinaStorage.createQuizResponse(quizInput);
      return res.status(201).json(quiz);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Invalid quiz payload" });
      }
      console.error("Error creating quiz response:", error);
      return res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Fetch a quiz response by ID
  app.get("/api/quiz-response/:id", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const quiz = await curalinaStorage.getQuizResponse(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz response not found" });
      }
      return res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz response:", error);
      return res.status(500).json({ message: "Failed to fetch quiz response" });
    }
  });

  // Create a render record for a quiz response.
  // This local implementation does NOT call external AI services; it simply
  // creates a completed render record so the UI flow works in development.
  app.post("/api/render", async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user?.id;
      const { quizResponseId, sessionId, productSkus } = req.body as {
        quizResponseId?: string;
        sessionId?: string;
        productSkus?: string[];
      };

      if (!quizResponseId || !sessionId) {
        return res.status(400).json({ message: "quizResponseId and sessionId are required" });
      }

      const renderInput = insertRenderSchema.parse({
        quizResponseId,
        sessionId,
        userId: userId ?? undefined,
        // For now, use a static placeholder image so the UI
        // always has something to display both locally and in demos.
        imageUrl:
          "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600",
        prompt: "Local development render placeholder based on quiz response",
        productSkus: productSkus ?? [],
        status: "completed",
      } as any);

      const render = await curalinaStorage.createRender(renderInput);
      return res.status(201).json(render);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid render payload" });
      }
      console.error("Error creating render:", error);
      return res.status(500).json({ message: "Failed to create render" });
    }
  });

  // Fetch a specific render by ID
  app.get("/api/render/:id", async (req: Request, res: Response): Promise<Response> => {
    try {
      const render = await curalinaStorage.getRender(req.params.id);
      if (!render) {
        return res.status(404).json({ message: "Render not found" });
      }
      return res.json(render);
    } catch (error) {
      console.error("Error fetching render:", error);
      return res.status(500).json({ message: "Failed to fetch render" });
    }
  });

  // Fetch latest render for a session (used by polling in Results page)
  app.get("/api/render/latest", async (req: Request, res: Response): Promise<Response> => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId query parameter is required" });
      }

      const render = await curalinaStorage.getLatestRenderBySession(sessionId);
      if (!render) {
        return res.status(404).json({ message: "No render found for session" });
      }
      return res.json(render);
    } catch (error) {
      console.error("Error fetching latest render:", error);
      return res.status(500).json({ message: "Failed to fetch latest render" });
    }
  });

  // ===== ADMIN ROUTES =====
  app.use("/admin", isAuthenticated, isAdmin, mappingAnalysisRoutes);

  // Curalina AI routes
  registerCuralinaRoutes(app);
  
  const httpServer = createServer(app);
  return httpServer;
}
