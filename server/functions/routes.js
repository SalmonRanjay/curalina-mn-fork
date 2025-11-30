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
exports.isAdmin = void 0;
exports.registerRoutes = registerRoutes;
const http_1 = require("http");
const storage_js_1 = require("./storage.js");
const localAuth_js_1 = require("./localAuth.js");
const objectStorage_js_1 = require("./objectStorage.js");
const objectAcl_js_1 = require("./objectAcl.js");
const schema_js_1 = require("@shared/schema.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
// Admin-only middleware
const isAdmin = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    return next();
};
exports.isAdmin = isAdmin;
async function registerRoutes(app) {
    // Auth middleware
    await (0, localAuth_js_1.setupAuth)(app);
    // Auth routes
    app.get('/api/auth/user', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            // Don't send password to client
            const { password, ...userWithoutPassword } = user;
            return res.json(userWithoutPassword);
        }
        catch (error) {
            console.error("Error fetching user:", error);
            return res.status(500).json({ message: "Failed to fetch user" });
        }
    });
    // User profile routes
    app.put('/api/users/profile', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { firstName, lastName, bio } = req.body;
            const user = await storage_js_1.storage.getUser(userId);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const updatedUser = await storage_js_1.storage.upsertUser({
                ...user,
                firstName: firstName !== null && firstName !== void 0 ? firstName : user.firstName,
                lastName: lastName !== null && lastName !== void 0 ? lastName : user.lastName,
                bio: bio !== null && bio !== void 0 ? bio : user.bio,
            });
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "profile_updated",
                description: "Updated profile information",
            });
            return res.json(updatedUser);
        }
        catch (error) {
            console.error("Error updating profile:", error);
            return res.status(500).json({ message: "Failed to update profile" });
        }
    });
    // Admin user management routes
    app.get('/api/admin/users', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const allUsers = await storage_js_1.storage.getAllUsers();
            const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
            return res.json(usersWithoutPasswords);
        }
        catch (error) {
            console.error("Error fetching users:", error);
            return res.status(500).json({ message: "Failed to fetch users" });
        }
    });
    app.post('/api/admin/users', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const createUserSchema = zod_1.z.object({
                email: zod_1.z.string().email("Invalid email address"),
                password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
                firstName: zod_1.z.string().min(1, "First name is required"),
                lastName: zod_1.z.string().min(1, "Last name is required"),
                role: zod_1.z.enum(["user", "admin"]).default("user"),
            });
            const validatedData = createUserSchema.parse(req.body);
            const existingUser = await storage_js_1.storage.getUserByEmail(validatedData.email);
            if (existingUser) {
                return res.status(400).json({ message: "User with this email already exists" });
            }
            const hashedPassword = await bcryptjs_1.default.hash(validatedData.password, 10);
            const newUser = await storage_js_1.storage.createUser({
                ...validatedData,
                password: hashedPassword,
            });
            await storage_js_1.storage.createActivityLog({
                userId: req.user.id,
                action: "user_created",
                description: `Created new user: ${newUser.email}`,
                metadata: { createdUserId: newUser.id },
            });
            const { password, ...userWithoutPassword } = newUser;
            return res.json(userWithoutPassword);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Error creating user:", error);
            return res.status(500).json({ message: "Failed to create user" });
        }
    });
    app.put('/api/admin/users/:id', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const updateUserSchema = zod_1.z.object({
                email: zod_1.z.string().email("Invalid email address").optional(),
                firstName: zod_1.z.string().min(1, "First name is required").optional(),
                lastName: zod_1.z.string().min(1, "Last name is required").optional(),
                role: zod_1.z.enum(["user", "admin"]).optional(),
                password: zod_1.z.string().min(8, "Password must be at least 8 characters").optional(),
            });
            const validatedData = updateUserSchema.parse(req.body);
            const existingUser = await storage_js_1.storage.getUser(id);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            if (validatedData.email && validatedData.email !== existingUser.email) {
                const emailExists = await storage_js_1.storage.getUserByEmail(validatedData.email);
                if (emailExists) {
                    return res.status(400).json({ message: "Email already in use" });
                }
            }
            const updates = {};
            if (validatedData.email)
                updates.email = validatedData.email;
            if (validatedData.firstName)
                updates.firstName = validatedData.firstName;
            if (validatedData.lastName)
                updates.lastName = validatedData.lastName;
            if (validatedData.role)
                updates.role = validatedData.role;
            if (validatedData.password) {
                updates.password = await bcryptjs_1.default.hash(validatedData.password, 10);
            }
            const updatedUser = await storage_js_1.storage.updateUser(id, updates);
            await storage_js_1.storage.createActivityLog({
                userId: req.user.id,
                action: "user_updated",
                description: `Updated user: ${updatedUser.email}`,
                metadata: { updatedUserId: id, changes: Object.keys(updates) },
            });
            const { password, ...userWithoutPassword } = updatedUser;
            return res.json(userWithoutPassword);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Error updating user:", error);
            return res.status(500).json({ message: "Failed to update user" });
        }
    });
    app.delete('/api/admin/users/:id', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            if (id === req.user.id) {
                return res.status(400).json({ message: "Cannot delete your own account" });
            }
            const existingUser = await storage_js_1.storage.getUser(id);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            await storage_js_1.storage.deleteUser(id);
            await storage_js_1.storage.createActivityLog({
                userId: req.user.id,
                action: "user_deleted",
                description: `Deleted user: ${existingUser.email}`,
                metadata: { deletedUserId: id },
            });
            return res.json({ message: "User deleted successfully" });
        }
        catch (error) {
            console.error("Error deleting user:", error);
            return res.status(500).json({ message: "Failed to delete user" });
        }
    });
    // Content routes (admin only for create/update/delete)
    app.get('/api/content', async (req, res) => {
        try {
            const items = await storage_js_1.storage.getAllContent();
            return res.json(items);
        }
        catch (error) {
            console.error("Error fetching content:", error);
            return res.status(500).json({ message: "Failed to fetch content" });
        }
    });
    app.get('/api/content/:id', async (req, res) => {
        try {
            const item = await storage_js_1.storage.getContent(req.params.id);
            if (!item) {
                return res.status(404).json({ message: "Content not found" });
            }
            return res.json(item);
        }
        catch (error) {
            console.error("Error fetching content:", error);
            return res.status(500).json({ message: "Failed to fetch content" });
        }
    });
    app.post('/api/content', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const userId = req.user.id;
            const validatedData = schema_js_1.insertContentSchema.parse({
                ...req.body,
                authorId: userId,
            });
            const item = await storage_js_1.storage.createContent(validatedData);
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "content_created",
                description: `Created content: ${item.title}`,
                metadata: { contentId: item.id },
            });
            return res.json(item);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Error creating content:", error);
            return res.status(500).json({ message: "Failed to create content" });
        }
    });
    app.put('/api/content/:id', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const existing = await storage_js_1.storage.getContent(id);
            if (!existing) {
                return res.status(404).json({ message: "Content not found" });
            }
            const item = await storage_js_1.storage.updateContent(id, req.body);
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "content_updated",
                description: `Updated content: ${item.title}`,
                metadata: { contentId: item.id },
            });
            return res.json(item);
        }
        catch (error) {
            console.error("Error updating content:", error);
            return res.status(500).json({ message: "Failed to update content" });
        }
    });
    app.delete('/api/content/:id', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const existing = await storage_js_1.storage.getContent(id);
            if (!existing) {
                return res.status(404).json({ message: "Content not found" });
            }
            await storage_js_1.storage.deleteContent(id);
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "content_deleted",
                description: `Deleted content: ${existing.title}`,
                metadata: { contentId: id },
            });
            return res.json({ message: "Content deleted" });
        }
        catch (error) {
            console.error("Error deleting content:", error);
            return res.status(500).json({ message: "Failed to delete content" });
        }
    });
    // Settings routes (admin only)
    app.get('/api/settings', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const allSettings = await storage_js_1.storage.getAllSettings();
            return res.json(allSettings);
        }
        catch (error) {
            console.error("Error fetching settings:", error);
            return res.status(500).json({ message: "Failed to fetch settings" });
        }
    });
    app.get('/api/settings/:key', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const setting = await storage_js_1.storage.getSetting(req.params.key);
            if (!setting) {
                return res.status(404).json({ message: "Setting not found" });
            }
            return res.json(setting);
        }
        catch (error) {
            console.error("Error fetching setting:", error);
            return res.status(500).json({ message: "Failed to fetch setting" });
        }
    });
    app.put('/api/settings/:key', localAuth_js_1.isAuthenticated, exports.isAdmin, async (req, res) => {
        try {
            const userId = req.user.id;
            const validatedData = schema_js_1.insertSettingsSchema.parse({
                key: req.params.key,
                ...req.body,
            });
            const setting = await storage_js_1.storage.upsertSetting(validatedData);
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "settings_updated",
                description: `Updated setting: ${setting.key}`,
                metadata: { settingKey: setting.key },
            });
            return res.json(setting);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Error updating setting:", error);
            return res.status(500).json({ message: "Failed to update setting" });
        }
    });
    // Activity log routes
    app.get('/api/activity', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await storage_js_1.storage.getUser(userId);
            // Admins can see all activity, users can only see their own
            const logs = (user === null || user === void 0 ? void 0 : user.role) === "admin"
                ? await storage_js_1.storage.getActivityLog()
                : await storage_js_1.storage.getActivityLog(userId);
            return res.json(logs);
        }
        catch (error) {
            console.error("Error fetching activity log:", error);
            return res.status(500).json({ message: "Failed to fetch activity log" });
        }
    });
    // ===== USER DASHBOARD ROUTES =====
    // Get user dashboard stats
    app.get('/api/my-dashboard/stats', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const stats = await storage_js_1.storage.getUserDashboardStats(userId);
            return res.json(stats);
        }
        catch (error) {
            console.error("Error fetching dashboard stats:", error);
            return res.status(500).json({ message: "Failed to fetch dashboard stats" });
        }
    });
    // Get user's renders
    app.get('/api/my-dashboard/renders', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const renders = await storage_js_1.storage.getUserRenders(userId);
            return res.json(renders);
        }
        catch (error) {
            console.error("Error fetching user renders:", error);
            return res.status(500).json({ message: "Failed to fetch renders" });
        }
    });
    // Get user's quiz responses
    app.get('/api/my-dashboard/quiz-responses', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const responses = await storage_js_1.storage.getUserQuizResponses(userId);
            return res.json(responses);
        }
        catch (error) {
            console.error("Error fetching quiz responses:", error);
            return res.status(500).json({ message: "Failed to fetch quiz responses" });
        }
    });
    // Get user's cart items
    app.get('/api/my-dashboard/cart', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const items = await storage_js_1.storage.getUserCartItems(userId);
            return res.json(items);
        }
        catch (error) {
            console.error("Error fetching cart items:", error);
            return res.status(500).json({ message: "Failed to fetch cart items" });
        }
    });
    // Get user's orders
    app.get('/api/my-dashboard/orders', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const orders = await storage_js_1.storage.getUserOrders(userId);
            return res.json(orders);
        }
        catch (error) {
            console.error("Error fetching orders:", error);
            return res.status(500).json({ message: "Failed to fetch orders" });
        }
    });
    // Get specific order details
    app.get('/api/my-dashboard/orders/:orderId', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { orderId } = req.params;
            const order = await storage_js_1.storage.getOrderById(orderId, userId);
            if (!order) {
                return res.status(404).json({ message: "Order not found" });
            }
            return res.json(order);
        }
        catch (error) {
            console.error("Error fetching order:", error);
            return res.status(500).json({ message: "Failed to fetch order" });
        }
    });
    // ===== SAVED DESIGNS ROUTES =====
    // Get user's saved designs
    app.get('/api/my-dashboard/saved-designs', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const designs = await storage_js_1.storage.getSavedDesigns(userId);
            return res.json(designs);
        }
        catch (error) {
            console.error("Error fetching saved designs:", error);
            return res.status(500).json({ message: "Failed to fetch saved designs" });
        }
    });
    // Save a design
    app.post('/api/my-dashboard/saved-designs', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { renderId, title, notes } = req.body;
            if (!renderId) {
                return res.status(400).json({ message: "Render ID is required" });
            }
            // Check if already saved
            const existing = await storage_js_1.storage.isRenderSaved(userId, renderId);
            if (existing) {
                return res.status(400).json({ message: "Design already saved" });
            }
            const saved = await storage_js_1.storage.createSavedDesign({
                userId,
                renderId,
                title,
                notes,
                isPublic: false,
            });
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "design_saved",
                description: `Saved design: ${title || renderId}`,
                metadata: { renderId },
            });
            return res.json(saved);
        }
        catch (error) {
            console.error("Error saving design:", error);
            return res.status(500).json({ message: "Failed to save design" });
        }
    });
    // Update a saved design (title, notes, sharing)
    app.patch('/api/my-dashboard/saved-designs/:id', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { title, notes, isPublic } = req.body;
            const existing = await storage_js_1.storage.getSavedDesignById(id, userId);
            if (!existing) {
                return res.status(404).json({ message: "Saved design not found" });
            }
            // Generate share token if making public and doesn't have one
            let shareToken = existing.shareToken;
            if (isPublic && !shareToken) {
                shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            const updated = await storage_js_1.storage.updateSavedDesign(id, userId, {
                title: title !== null && title !== void 0 ? title : existing.title,
                notes: notes !== null && notes !== void 0 ? notes : existing.notes,
                isPublic: isPublic !== null && isPublic !== void 0 ? isPublic : existing.isPublic,
                shareToken,
            });
            return res.json(updated);
        }
        catch (error) {
            console.error("Error updating saved design:", error);
            return res.status(500).json({ message: "Failed to update saved design" });
        }
    });
    // Delete a saved design
    app.delete('/api/my-dashboard/saved-designs/:id', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const existing = await storage_js_1.storage.getSavedDesignById(id, userId);
            if (!existing) {
                return res.status(404).json({ message: "Saved design not found" });
            }
            await storage_js_1.storage.deleteSavedDesign(id, userId);
            await storage_js_1.storage.createActivityLog({
                userId,
                action: "design_unsaved",
                description: `Removed saved design`,
                metadata: { savedDesignId: id },
            });
            return res.json({ success: true });
        }
        catch (error) {
            console.error("Error deleting saved design:", error);
            return res.status(500).json({ message: "Failed to delete saved design" });
        }
    });
    // Check if a render is saved
    app.get('/api/my-dashboard/is-saved/:renderId', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { renderId } = req.params;
            const isSaved = await storage_js_1.storage.isRenderSaved(userId, renderId);
            return res.json({ isSaved });
        }
        catch (error) {
            console.error("Error checking if render is saved:", error);
            return res.status(500).json({ message: "Failed to check saved status" });
        }
    });
    // Public shared design view
    app.get('/api/shared-design/:shareToken', async (req, res) => {
        try {
            const { shareToken } = req.params;
            const design = await storage_js_1.storage.getSavedDesignByShareToken(shareToken);
            if (!design || !design.isPublic) {
                return res.status(404).json({ message: "Shared design not found" });
            }
            return res.json(design);
        }
        catch (error) {
            console.error("Error fetching shared design:", error);
            return res.status(500).json({ message: "Failed to fetch shared design" });
        }
    });
    // ===== PRODUCT INTERACTIONS =====
    // Log product interaction
    app.post('/api/product-interactions', async (req, res) => {
        var _a;
        try {
            const { productId, interactionType, metadata, sessionId } = req.body;
            if (!productId || !interactionType) {
                return res.status(400).json({ message: "Product ID and interaction type are required" });
            }
            const interaction = await storage_js_1.storage.createProductInteraction({
                userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null,
                sessionId: sessionId || null,
                productId,
                interactionType,
                metadata,
            });
            return res.json(interaction);
        }
        catch (error) {
            console.error("Error logging product interaction:", error);
            return res.status(500).json({ message: "Failed to log interaction" });
        }
    });
    // Get user's product interactions
    app.get('/api/my-dashboard/product-interactions', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const interactions = await storage_js_1.storage.getUserProductInteractions(userId);
            return res.json(interactions);
        }
        catch (error) {
            console.error("Error fetching product interactions:", error);
            return res.status(500).json({ message: "Failed to fetch product interactions" });
        }
    });
    // ===== SESSION DATA MIGRATION =====
    // Migrate anonymous session data to authenticated user
    app.post('/api/migrate-session-data', localAuth_js_1.isAuthenticated, async (req, res) => {
        try {
            const userId = req.user.id;
            const { sessionId } = req.body;
            if (!sessionId) {
                return res.status(400).json({ message: "Session ID is required" });
            }
            await storage_js_1.storage.migrateSessionDataToUser(sessionId, userId);
            return res.json({ success: true });
        }
        catch (error) {
            console.error("Error migrating session data:", error);
            return res.status(500).json({ message: "Failed to migrate session data" });
        }
    });
    // Object storage routes
    app.get("/public-objects/:filePath(*)", async (req, res) => {
        const filePath = req.params.filePath;
        const objectStorageService = new objectStorage_js_1.ObjectStorageService();
        try {
            const file = await objectStorageService.searchPublicObject(filePath);
            if (!file) {
                return res.status(404).json({ error: "File not found" });
            }
            return objectStorageService.downloadObject(file, res);
        }
        catch (error) {
            console.error("Error searching for public object:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
    app.get("/objects/:objectPath(*)", localAuth_js_1.isAuthenticated, async (req, res) => {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const objectStorageService = new objectStorage_js_1.ObjectStorageService();
        try {
            const objectFile = await objectStorageService.getObjectEntityFile(req.path);
            const canAccess = await objectStorageService.canAccessObjectEntity({
                objectFile,
                userId: userId,
                requestedPermission: objectAcl_js_1.ObjectPermission.READ,
            });
            if (!canAccess) {
                return res.sendStatus(401);
            }
            return objectStorageService.downloadObject(objectFile, res);
        }
        catch (error) {
            console.error("Error checking object access:", error);
            if (error instanceof objectStorage_js_1.ObjectNotFoundError) {
                return res.sendStatus(404);
            }
            return res.sendStatus(500);
        }
    });
    app.post("/api/objects/upload", localAuth_js_1.isAuthenticated, async (req, res) => {
        const objectStorageService = new objectStorage_js_1.ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        return res.json({ uploadURL });
    });
    app.put("/api/profile-image", localAuth_js_1.isAuthenticated, async (req, res) => {
        var _a;
        if (!req.body.imageURL) {
            return res.status(400).json({ error: "imageURL is required" });
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        try {
            const objectStorageService = new objectStorage_js_1.ObjectStorageService();
            const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(req.body.imageURL, {
                owner: userId,
                visibility: "public",
            });
            // Update user profile with new image
            const user = await storage_js_1.storage.getUser(userId);
            if (user) {
                await storage_js_1.storage.upsertUser({
                    ...user,
                    profileImageUrl: objectPath,
                });
            }
            await storage_js_1.storage.createActivityLog({
                userId: userId,
                action: "profile_image_updated",
                description: "Updated profile image",
            });
            return res.status(200).json({
                objectPath: objectPath,
            });
        }
        catch (error) {
            console.error("Error setting profile image:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
    // Import and register Curalina AI routes
    const curalinaRoutesModule = await Promise.resolve().then(() => __importStar(require("./routes-curalina.js")));
    curalinaRoutesModule.registerCuralinaRoutes(app);
    // Mapping analysis routes
    const mappingAnalysisRoutes = await Promise.resolve().then(() => __importStar(require("./routes-mapping-analysis.js")));
    app.use("/api/admin", localAuth_js_1.isAuthenticated, exports.isAdmin, mappingAnalysisRoutes.default);
    const httpServer = (0, http_1.createServer)(app);
    return httpServer;
}
