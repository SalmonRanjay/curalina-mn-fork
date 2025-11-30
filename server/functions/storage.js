"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_js_1 = require("@shared/schema.js"); // Add .js extension
const db_js_1 = require("./db.js"); // Add .js extension
const drizzle_orm_1 = require("drizzle-orm");
class DatabaseStorage {
    // User operations
    async getUser(id) {
        const [user] = await (0, db_js_1.getDb)().select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await (0, db_js_1.getDb)().select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.email, email));
        return user;
    }
    async createUser(userData) {
        const [user] = await (0, db_js_1.getDb)().insert(schema_js_1.users).values(userData).returning();
        return user;
    }
    async upsertUser(userData) {
        const existingUserById = userData.id ? await (0, db_js_1.getDb)().select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userData.id)).limit(1) : [];
        const existingUserByEmail = userData.email ? await (0, db_js_1.getDb)().select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.email, userData.email)).limit(1) : [];
        const existingUser = existingUserById[0] || existingUserByEmail[0];
        if (existingUser) {
            const { role: _, ...userDataWithoutRole } = userData;
            const [updatedUser] = await (0, db_js_1.getDb)()
                .update(schema_js_1.users)
                .set({
                ...userDataWithoutRole,
                role: existingUser.role,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, existingUser.id))
                .returning();
            return updatedUser;
        }
        else {
            const [newUser] = await (0, db_js_1.getDb)()
                .insert(schema_js_1.users)
                .values(userData)
                .returning();
            return newUser;
        }
    }
    async getAllUsers() {
        return (0, db_js_1.getDb)().select().from(schema_js_1.users).orderBy((0, drizzle_orm_1.desc)(schema_js_1.users.createdAt));
    }
    async updateUser(id, updates) {
        const [user] = await (0, db_js_1.getDb)()
            .update(schema_js_1.users)
            .set({ ...updates, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id))
            .returning();
        return user;
    }
    async deleteUser(id) {
        await (0, db_js_1.getDb)().delete(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id));
    }
    // Content operations
    async getAllContent() {
        return (0, db_js_1.getDb)().select().from(schema_js_1.content).orderBy((0, drizzle_orm_1.desc)(schema_js_1.content.createdAt));
    }
    async getContent(id) {
        const [item] = await (0, db_js_1.getDb)().select().from(schema_js_1.content).where((0, drizzle_orm_1.eq)(schema_js_1.content.id, id));
        return item;
    }
    async createContent(contentData) {
        const [item] = await (0, db_js_1.getDb)().insert(schema_js_1.content).values(contentData).returning();
        return item;
    }
    async updateContent(id, contentData) {
        const [item] = await (0, db_js_1.getDb)()
            .update(schema_js_1.content)
            .set({ ...contentData, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.content.id, id))
            .returning();
        return item;
    }
    async deleteContent(id) {
        await (0, db_js_1.getDb)().delete(schema_js_1.content).where((0, drizzle_orm_1.eq)(schema_js_1.content.id, id));
    }
    // Settings operations
    async getAllSettings() {
        return (0, db_js_1.getDb)().select().from(schema_js_1.settings);
    }
    async getSetting(key) {
        const [setting] = await (0, db_js_1.getDb)().select().from(schema_js_1.settings).where((0, drizzle_orm_1.eq)(schema_js_1.settings.key, key));
        return setting;
    }
    async upsertSetting(settingData) {
        const [setting] = await (0, db_js_1.getDb)()
            .insert(schema_js_1.settings)
            .values(settingData)
            .onConflictDoUpdate({
            target: schema_js_1.settings.key,
            set: {
                ...settingData,
                updatedAt: new Date(),
            },
        })
            .returning();
        return setting;
    }
    // Activity log operations
    async getActivityLog(userId) {
        if (userId) {
            return (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.activityLog)
                .where((0, drizzle_orm_1.eq)(schema_js_1.activityLog.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_js_1.activityLog.createdAt))
                .limit(100);
        }
        return (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.activityLog)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.activityLog.createdAt))
            .limit(100);
    }
    async createActivityLog(logData) {
        const [log] = await (0, db_js_1.getDb)().insert(schema_js_1.activityLog).values(logData).returning();
        return log;
    }
    // User Dashboard operations
    async getUserDashboardStats(userId) {
        const [renderCount] = await (0, db_js_1.getDb)()
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_js_1.renders)
            .where((0, drizzle_orm_1.eq)(schema_js_1.renders.userId, userId));
        const [savedCount] = await (0, db_js_1.getDb)()
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId));
        const [cartCount] = await (0, db_js_1.getDb)()
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_js_1.cartItems)
            .where((0, drizzle_orm_1.eq)(schema_js_1.cartItems.userId, userId));
        const [orderStats] = await (0, db_js_1.getDb)()
            .select({
            count: (0, drizzle_orm_1.count)(),
            total: (0, drizzle_orm_1.sql) `COALESCE(SUM(CAST(${schema_js_1.orders.totalAmount} AS DECIMAL)), 0)`,
        })
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.userId, userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.status, 'paid'), (0, drizzle_orm_1.eq)(schema_js_1.orders.status, 'fulfilled'), (0, drizzle_orm_1.eq)(schema_js_1.orders.status, 'shipped'), (0, drizzle_orm_1.eq)(schema_js_1.orders.status, 'delivered'))));
        return {
            totalRenders: (renderCount === null || renderCount === void 0 ? void 0 : renderCount.count) || 0,
            savedDesigns: (savedCount === null || savedCount === void 0 ? void 0 : savedCount.count) || 0,
            cartItems: (cartCount === null || cartCount === void 0 ? void 0 : cartCount.count) || 0,
            completedOrders: (orderStats === null || orderStats === void 0 ? void 0 : orderStats.count) || 0,
            totalSpent: (orderStats === null || orderStats === void 0 ? void 0 : orderStats.total) || '0',
        };
    }
    async getUserRenders(userId) {
        const userRenders = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.renders)
            .where((0, drizzle_orm_1.eq)(schema_js_1.renders.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.renders.createdAt));
        const rendersWithDetails = [];
        for (const render of userRenders) {
            const [quiz] = await (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.quizResponses)
                .where((0, drizzle_orm_1.eq)(schema_js_1.quizResponses.id, render.quizResponseId));
            const [saved] = await (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.savedDesigns)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.renderId, render.id)));
            rendersWithDetails.push({
                ...render,
                quizResponse: quiz,
                savedDesign: saved || null,
            });
        }
        return rendersWithDetails;
    }
    async getUserQuizResponses(userId) {
        return (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.quizResponses)
            .where((0, drizzle_orm_1.eq)(schema_js_1.quizResponses.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.quizResponses.createdAt));
    }
    async getUserCartItems(userId) {
        const items = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.cartItems)
            .where((0, drizzle_orm_1.eq)(schema_js_1.cartItems.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.cartItems.createdAt));
        const itemsWithProducts = [];
        for (const item of items) {
            const [product] = await (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.products)
                .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, item.productId));
            if (product) {
                itemsWithProducts.push({
                    ...item,
                    product,
                });
            }
        }
        return itemsWithProducts;
    }
    async getUserOrders(userId) {
        const userOrders = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.orders.createdAt));
        const ordersWithItems = [];
        for (const order of userOrders) {
            const items = await (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.orderItems)
                .where((0, drizzle_orm_1.eq)(schema_js_1.orderItems.orderId, order.id));
            const itemsWithProducts = [];
            for (const item of items) {
                const [product] = await (0, db_js_1.getDb)()
                    .select()
                    .from(schema_js_1.products)
                    .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, item.productId));
                if (product) {
                    itemsWithProducts.push({
                        ...item,
                        product,
                    });
                }
            }
            ordersWithItems.push({
                ...order,
                items: itemsWithProducts,
            });
        }
        return ordersWithItems;
    }
    async getOrderById(orderId, userId) {
        const [order] = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId), (0, drizzle_orm_1.eq)(schema_js_1.orders.userId, userId)));
        if (!order)
            return undefined;
        const items = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.orderItems)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orderItems.orderId, order.id));
        const itemsWithProducts = [];
        for (const item of items) {
            const [product] = await (0, db_js_1.getDb)()
                .select()
                .from(schema_js_1.products)
                .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, item.productId));
            if (product) {
                itemsWithProducts.push({
                    ...item,
                    product,
                });
            }
        }
        return {
            ...order,
            items: itemsWithProducts,
        };
    }
    // Saved Designs operations
    async getSavedDesigns(userId) {
        return (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.savedDesigns.createdAt));
    }
    async getSavedDesignById(id, userId) {
        const [design] = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.id, id), (0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId)));
        return design;
    }
    async getSavedDesignByShareToken(shareToken) {
        const [design] = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.shareToken, shareToken));
        return design;
    }
    async createSavedDesign(design) {
        const [saved] = await (0, db_js_1.getDb)().insert(schema_js_1.savedDesigns).values(design).returning();
        return saved;
    }
    async updateSavedDesign(id, userId, updates) {
        const [design] = await (0, db_js_1.getDb)()
            .update(schema_js_1.savedDesigns)
            .set(updates)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.id, id), (0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId)))
            .returning();
        return design;
    }
    async deleteSavedDesign(id, userId) {
        await (0, db_js_1.getDb)()
            .delete(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.id, id), (0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId)));
    }
    async isRenderSaved(userId, renderId) {
        const [design] = await (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.savedDesigns)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.userId, userId), (0, drizzle_orm_1.eq)(schema_js_1.savedDesigns.renderId, renderId)));
        return !!design;
    }
    // Product Interactions operations
    async createProductInteraction(interaction) {
        const [created] = await (0, db_js_1.getDb)().insert(schema_js_1.productInteractions).values(interaction).returning();
        return created;
    }
    async getUserProductInteractions(userId) {
        return (0, db_js_1.getDb)()
            .select()
            .from(schema_js_1.productInteractions)
            .where((0, drizzle_orm_1.eq)(schema_js_1.productInteractions.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.productInteractions.createdAt))
            .limit(100);
    }
    // Session to User data migration - links existing session data to authenticated user
    async migrateSessionDataToUser(sessionId, userId) {
        await (0, db_js_1.getDb)()
            .update(schema_js_1.quizResponses)
            .set({ userId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.quizResponses.sessionId, sessionId), (0, drizzle_orm_1.sql) `${schema_js_1.quizResponses.userId} IS NULL`));
        await (0, db_js_1.getDb)()
            .update(schema_js_1.renders)
            .set({ userId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.renders.sessionId, sessionId), (0, drizzle_orm_1.sql) `${schema_js_1.renders.userId} IS NULL`));
        await (0, db_js_1.getDb)()
            .update(schema_js_1.cartItems)
            .set({ userId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.cartItems.sessionId, sessionId), (0, drizzle_orm_1.sql) `${schema_js_1.cartItems.userId} IS NULL`));
        await (0, db_js_1.getDb)()
            .update(schema_js_1.orders)
            .set({ userId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.sessionId, sessionId), (0, drizzle_orm_1.sql) `${schema_js_1.orders.userId} IS NULL`));
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
