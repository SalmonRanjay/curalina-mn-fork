import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./localAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertContentSchema, insertSettingsSchema, User } from "@shared/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Define a custom Request type that includes the user property
interface RequestWithUser extends Request {
  user?: User;
}

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
  app.get('/auth/user', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const user = (req as RequestWithUser).user;
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Don't send password to client
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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

  // Content routes (admin only for create/update/delete)
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

  // Settings routes (admin only)
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

  // Get user dashboard stats
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

  // Get user's renders
  app.get('/my-dashboard/renders', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const renders = await storage.getUserRenders(userId);
      return res.json(renders);
    } catch (error) {
      console.error("Error fetching user renders:", error);
      return res.status(500).json({ message: "Failed to fetch renders" });
    }
  });

  // Get user's quiz responses
  app.get('/my-dashboard/quiz-responses', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const responses = await storage.getUserQuizResponses(userId);
      return res.json(responses);
    } catch (error) {
      console.error("Error fetching quiz responses:", error);
      return res.status(500).json({ message: "Failed to fetch quiz responses" });
    }
  });

  // Get user's cart items
  app.get('/my-dashboard/cart', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const items = await storage.getUserCartItems(userId);
      return res.json(items);
    } catch (error) {
      console.error("Error fetching cart items:", error);
      return res.status(500).json({ message: "Failed to fetch cart items" });
    }
  });

  // Get user's orders
  app.get('/my-dashboard/orders', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const orders = await storage.getUserOrders(userId);
      return res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      return res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get specific order details
  app.get('/my-dashboard/orders/:orderId', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { orderId } = req.params;
      const order = await storage.getOrderById(orderId, userId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      return res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      return res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // ===== SAVED DESIGNS ROUTES =====

  // Get user's saved designs
  app.get('/my-dashboard/saved-designs', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const designs = await storage.getSavedDesigns(userId);
      return res.json(designs);
    } catch (error) {
      console.error("Error fetching saved designs:", error);
      return res.status(500).json({ message: "Failed to fetch saved designs" });
    }
  });

  // Save a design
  app.post('/my-dashboard/saved-designs', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { renderId, title, notes } = req.body;

      if (!renderId) {
        return res.status(400).json({ message: "Render ID is required" });
      }

      // Check if already saved
      const existing = await storage.isRenderSaved(userId, renderId);
      if (existing) {
        return res.status(400).json({ message: "Design already saved" });
      }

      const saved = await storage.createSavedDesign({
        userId,
        renderId,
        title,
        notes,
        isPublic: false,
      });

      await storage.createActivityLog({
        userId,
        action: "design_saved",
        description: `Saved design: ${title || renderId}`,
        metadata: { renderId },
      });

      return res.json(saved);
    } catch (error) {
      console.error("Error saving design:", error);
      return res.status(500).json({ message: "Failed to save design" });
    }
  });

  // Update a saved design (title, notes, sharing)
  app.patch('/my-dashboard/saved-designs/:id', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { id } = req.params;
      const { title, notes, isPublic } = req.body;

      const existing = await storage.getSavedDesignById(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Saved design not found" });
      }

      // Generate share token if making public and doesn't have one
      let shareToken = existing.shareToken;
      if (isPublic && !shareToken) {
        shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const updated = await storage.updateSavedDesign(id, userId, {
        title: title ?? existing.title,
        notes: notes ?? existing.notes,
        isPublic: isPublic ?? existing.isPublic,
        shareToken,
      });

      return res.json(updated);
    } catch (error) {
      console.error("Error updating saved design:", error);
      return res.status(500).json({ message: "Failed to update saved design" });
    }
  });

  // Delete a saved design
  app.delete('/my-dashboard/saved-designs/:id', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { id } = req.params;

      const existing = await storage.getSavedDesignById(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Saved design not found" });
      }

      await storage.deleteSavedDesign(id, userId);

      await storage.createActivityLog({
        userId,
        action: "design_unsaved",
        description: `Removed saved design`,
        metadata: { savedDesignId: id },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved design:", error);
      return res.status(500).json({ message: "Failed to delete saved design" });
    }
  });

  // Check if a render is saved
  app.get('/my-dashboard/is-saved/:renderId', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { renderId } = req.params;
      const isSaved = await storage.isRenderSaved(userId, renderId);
      return res.json({ isSaved });
    } catch (error) {
      console.error("Error checking if render is saved:", error);
      return res.status(500).json({ message: "Failed to check saved status" });
    }
  });

  // Public shared design view
  app.get('/shared-design/:shareToken', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { shareToken } = req.params;
      const design = await storage.getSavedDesignByShareToken(shareToken);

      if (!design || !design.isPublic) {
        return res.status(404).json({ message: "Shared design not found" });
      }

      return res.json(design);
    } catch (error) {
      console.error("Error fetching shared design:", error);
      return res.status(500).json({ message: "Failed to fetch shared design" });
    }
  });

  // ===== PRODUCT INTERACTIONS =====

  // Log product interaction
  app.post('/product-interactions', async (req: Request, res: Response): Promise<Response> => {
    try {
      const { productId, interactionType, metadata, sessionId } = req.body;

      if (!productId || !interactionType) {
        return res.status(400).json({ message: "Product ID and interaction type are required" });
      }

      const interaction = await storage.createProductInteraction({
        userId: (req as RequestWithUser).user?.id || null,
        sessionId: sessionId || null,
        productId,
        interactionType,
        metadata,
      });

      return res.json(interaction);
    } catch (error) {
      console.error("Error logging product interaction:", error);
      return res.status(500).json({ message: "Failed to log interaction" });
    }
  });

  // Get user's product interactions
  app.get('/my-dashboard/product-interactions', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const interactions = await storage.getUserProductInteractions(userId);
      return res.json(interactions);
    } catch (error) {
      console.error("Error fetching product interactions:", error);
      return res.status(500).json({ message: "Failed to fetch product interactions" });
    }
  });

  // ===== SESSION DATA MIGRATION =====

  // Migrate anonymous session data to authenticated user
  app.post('/migrate-session-data', isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as RequestWithUser).user!.id;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      await storage.migrateSessionDataToUser(sessionId, userId);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error migrating session data:", error);
      return res.status(500).json({ message: "Failed to migrate session data" });
    }
  });

  // Object storage routes
  app.get("/public-objects/:filePath(*)", async (req: Request, res: Response): Promise<Response | void> => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      return objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: Request, res: Response): Promise<Response | void> => {
    const userId = (req as RequestWithUser).user?.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      return objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/objects/upload", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    return res.json({ uploadURL });
  });

  // --- NEW: S3 Presigned URL Upload Route (JSON Body) ---
  app.post("/upload", async (req: Request, res: Response): Promise<Response> => {
    // If multipart/form-data request is received (old way), handle it
    if (req.is('multipart/form-data')) {
      // Return error to force frontend to switch, or handle gracefully if desired
      // But based on the instruction, we want to switch to JSON -> Presigned URL.
      // However, if we want backward compatibility or simpler migration,
      // we can try to detect.
      // For now, let's implement the presigned URL flow as requested.
      // The frontend should send JSON { fileName, contentType }.
      return res.status(400).json({ error: "This endpoint now expects JSON body for presigned URL generation." });
    }

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
        // ACL: 'public-read', // Optional: if you want files to be public immediately
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

      return res.json({
        method: "PUT",
        url,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
        },
        fields: {},
        // Return the final public URL for the frontend to use after upload
        // Assuming standard S3 URL structure or CloudFront
        publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
      });
    } catch (err) {
      console.error("Presigned URL generation error:", err);
      return res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.put("/profile-image", isAuthenticated, async (req: Request, res: Response): Promise<Response> => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    const userId = (req as RequestWithUser).user?.id;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      // Update user profile with new image
      const user = await storage.getUser(userId!);
      if (user) {
        await storage.upsertUser({
          ...user,
          profileImageUrl: objectPath,
        });
      }

      await storage.createActivityLog({
        userId: userId!,
        action: "profile_image_updated",
        description: "Updated profile image",
      });

      return res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting profile image:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Import and register Curalina AI routes
  const curalinaRoutesModule = await import("./routes-curalina");
  curalinaRoutesModule.registerCuralinaRoutes(app);

  // Mapping analysis routes
  const mappingAnalysisRoutes = await import("./routes-mapping-analysis");
  app.use("/admin", isAuthenticated, isAdmin, mappingAnalysisRoutes.default);

  const httpServer = createServer(app);
  return httpServer;
}
