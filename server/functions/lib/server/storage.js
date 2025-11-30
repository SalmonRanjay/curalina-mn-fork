import { users, content, settings, activityLog, renders, quizResponses, cartItems, orders, orderItems, savedDesigns, productInteractions, products, } from "@shared/schema"; // Add .js extension
import { getDb } from "./db"; // Add .js extension
import { eq, desc, and, or, sql, count } from "drizzle-orm";
export class DatabaseStorage {
    // User operations
    async getUser(id) {
        const [user] = await getDb().select().from(users).where(eq(users.id, id));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await getDb().select().from(users).where(eq(users.email, email));
        return user;
    }
    async createUser(userData) {
        const [user] = await getDb().insert(users).values(userData).returning();
        return user;
    }
    async upsertUser(userData) {
        const existingUserById = userData.id ? await getDb().select().from(users).where(eq(users.id, userData.id)).limit(1) : [];
        const existingUserByEmail = userData.email ? await getDb().select().from(users).where(eq(users.email, userData.email)).limit(1) : [];
        const existingUser = existingUserById[0] || existingUserByEmail[0];
        if (existingUser) {
            const { role: _, ...userDataWithoutRole } = userData;
            const [updatedUser] = await getDb()
                .update(users)
                .set({
                ...userDataWithoutRole,
                role: existingUser.role,
                updatedAt: new Date(),
            })
                .where(eq(users.id, existingUser.id))
                .returning();
            return updatedUser;
        }
        else {
            const [newUser] = await getDb()
                .insert(users)
                .values(userData)
                .returning();
            return newUser;
        }
    }
    async getAllUsers() {
        return getDb().select().from(users).orderBy(desc(users.createdAt));
    }
    async updateUser(id, updates) {
        const [user] = await getDb()
            .update(users)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();
        return user;
    }
    async deleteUser(id) {
        await getDb().delete(users).where(eq(users.id, id));
    }
    // Content operations
    async getAllContent() {
        return getDb().select().from(content).orderBy(desc(content.createdAt));
    }
    async getContent(id) {
        const [item] = await getDb().select().from(content).where(eq(content.id, id));
        return item;
    }
    async createContent(contentData) {
        const [item] = await getDb().insert(content).values(contentData).returning();
        return item;
    }
    async updateContent(id, contentData) {
        const [item] = await getDb()
            .update(content)
            .set({ ...contentData, updatedAt: new Date() })
            .where(eq(content.id, id))
            .returning();
        return item;
    }
    async deleteContent(id) {
        await getDb().delete(content).where(eq(content.id, id));
    }
    // Settings operations
    async getAllSettings() {
        return getDb().select().from(settings);
    }
    async getSetting(key) {
        const [setting] = await getDb().select().from(settings).where(eq(settings.key, key));
        return setting;
    }
    async upsertSetting(settingData) {
        const [setting] = await getDb()
            .insert(settings)
            .values(settingData)
            .onConflictDoUpdate({
            target: settings.key,
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
            return getDb()
                .select()
                .from(activityLog)
                .where(eq(activityLog.userId, userId))
                .orderBy(desc(activityLog.createdAt))
                .limit(100);
        }
        return getDb()
            .select()
            .from(activityLog)
            .orderBy(desc(activityLog.createdAt))
            .limit(100);
    }
    async createActivityLog(logData) {
        const [log] = await getDb().insert(activityLog).values(logData).returning();
        return log;
    }
    // User Dashboard operations
    async getUserDashboardStats(userId) {
        const [renderCount] = await getDb()
            .select({ count: count() })
            .from(renders)
            .where(eq(renders.userId, userId));
        const [savedCount] = await getDb()
            .select({ count: count() })
            .from(savedDesigns)
            .where(eq(savedDesigns.userId, userId));
        const [cartCount] = await getDb()
            .select({ count: count() })
            .from(cartItems)
            .where(eq(cartItems.userId, userId));
        const [orderStats] = await getDb()
            .select({
            count: count(),
            total: sql `COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        })
            .from(orders)
            .where(and(eq(orders.userId, userId), or(eq(orders.status, 'paid'), eq(orders.status, 'fulfilled'), eq(orders.status, 'shipped'), eq(orders.status, 'delivered'))));
        return {
            totalRenders: renderCount?.count || 0,
            savedDesigns: savedCount?.count || 0,
            cartItems: cartCount?.count || 0,
            completedOrders: orderStats?.count || 0,
            totalSpent: orderStats?.total || '0',
        };
    }
    async getUserRenders(userId) {
        const userRenders = await getDb()
            .select()
            .from(renders)
            .where(eq(renders.userId, userId))
            .orderBy(desc(renders.createdAt));
        const rendersWithDetails = [];
        for (const render of userRenders) {
            const [quiz] = await getDb()
                .select()
                .from(quizResponses)
                .where(eq(quizResponses.id, render.quizResponseId));
            const [saved] = await getDb()
                .select()
                .from(savedDesigns)
                .where(and(eq(savedDesigns.userId, userId), eq(savedDesigns.renderId, render.id)));
            rendersWithDetails.push({
                ...render,
                quizResponse: quiz,
                savedDesign: saved || null,
            });
        }
        return rendersWithDetails;
    }
    async getUserQuizResponses(userId) {
        return getDb()
            .select()
            .from(quizResponses)
            .where(eq(quizResponses.userId, userId))
            .orderBy(desc(quizResponses.createdAt));
    }
    async getUserCartItems(userId) {
        const items = await getDb()
            .select()
            .from(cartItems)
            .where(eq(cartItems.userId, userId))
            .orderBy(desc(cartItems.createdAt));
        const itemsWithProducts = [];
        for (const item of items) {
            const [product] = await getDb()
                .select()
                .from(products)
                .where(eq(products.id, item.productId));
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
        const userOrders = await getDb()
            .select()
            .from(orders)
            .where(eq(orders.userId, userId))
            .orderBy(desc(orders.createdAt));
        const ordersWithItems = [];
        for (const order of userOrders) {
            const items = await getDb()
                .select()
                .from(orderItems)
                .where(eq(orderItems.orderId, order.id));
            const itemsWithProducts = [];
            for (const item of items) {
                const [product] = await getDb()
                    .select()
                    .from(products)
                    .where(eq(products.id, item.productId));
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
        const [order] = await getDb()
            .select()
            .from(orders)
            .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
        if (!order)
            return undefined;
        const items = await getDb()
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));
        const itemsWithProducts = [];
        for (const item of items) {
            const [product] = await getDb()
                .select()
                .from(products)
                .where(eq(products.id, item.productId));
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
        return getDb()
            .select()
            .from(savedDesigns)
            .where(eq(savedDesigns.userId, userId))
            .orderBy(desc(savedDesigns.createdAt));
    }
    async getSavedDesignById(id, userId) {
        const [design] = await getDb()
            .select()
            .from(savedDesigns)
            .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)));
        return design;
    }
    async getSavedDesignByShareToken(shareToken) {
        const [design] = await getDb()
            .select()
            .from(savedDesigns)
            .where(eq(savedDesigns.shareToken, shareToken));
        return design;
    }
    async createSavedDesign(design) {
        const [saved] = await getDb().insert(savedDesigns).values(design).returning();
        return saved;
    }
    async updateSavedDesign(id, userId, updates) {
        const [design] = await getDb()
            .update(savedDesigns)
            .set(updates)
            .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)))
            .returning();
        return design;
    }
    async deleteSavedDesign(id, userId) {
        await getDb()
            .delete(savedDesigns)
            .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)));
    }
    async isRenderSaved(userId, renderId) {
        const [design] = await getDb()
            .select()
            .from(savedDesigns)
            .where(and(eq(savedDesigns.userId, userId), eq(savedDesigns.renderId, renderId)));
        return !!design;
    }
    // Product Interactions operations
    async createProductInteraction(interaction) {
        const [created] = await getDb().insert(productInteractions).values(interaction).returning();
        return created;
    }
    async getUserProductInteractions(userId) {
        return getDb()
            .select()
            .from(productInteractions)
            .where(eq(productInteractions.userId, userId))
            .orderBy(desc(productInteractions.createdAt))
            .limit(100);
    }
    // Session to User data migration - links existing session data to authenticated user
    async migrateSessionDataToUser(sessionId, userId) {
        await getDb()
            .update(quizResponses)
            .set({ userId })
            .where(and(eq(quizResponses.sessionId, sessionId), sql `${quizResponses.userId} IS NULL`));
        await getDb()
            .update(renders)
            .set({ userId })
            .where(and(eq(renders.sessionId, sessionId), sql `${renders.userId} IS NULL`));
        await getDb()
            .update(cartItems)
            .set({ userId })
            .where(and(eq(cartItems.sessionId, sessionId), sql `${cartItems.userId} IS NULL`));
        await getDb()
            .update(orders)
            .set({ userId })
            .where(and(eq(orders.sessionId, sessionId), sql `${orders.userId} IS NULL`));
    }
}
export const storage = new DatabaseStorage();
//# sourceMappingURL=storage.js.map