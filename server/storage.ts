import {
  users,
  content,
  settings,
  activityLog,
  renders,
  quizResponses,
  cartItems,
  orders,
  orderItems,
  savedDesigns,
  productInteractions,
  products,
  type User,
  type UpsertUser,
  type Content,
  type InsertContent,
  type Settings,
  type InsertSettings,
  type ActivityLog,
  type InsertActivityLog,
  type Render,
  type QuizResponse,
  type CartItem,
  type Order,
  type OrderItem,
  type SavedDesign,
  type InsertSavedDesign,
  type ProductInteraction,
  type InsertProductInteraction,
  type Product,
} from "@shared/schema"; // Add .js extension
import { getDb } from "./db"; // Add .js extension
import { eq, desc, and, or, sql, count } from "drizzle-orm";

// Types for dashboard data
export interface UserDashboardStats {
  totalRenders: number;
  savedDesigns: number;
  cartItems: number;
  completedOrders: number;
  totalSpent: string;
}

export interface RenderWithDetails extends Render {
  quizResponse?: QuizResponse;
  savedDesign?: SavedDesign | null;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { product: Product })[];
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Content operations
  getAllContent(): Promise<Content[]>;
  getContent(id: string): Promise<Content | undefined>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: string, content: Partial<InsertContent>): Promise<Content>;
  deleteContent(id: string): Promise<void>;
  
  // Settings operations
  getAllSettings(): Promise<Settings[]>;
  getSetting(key: string): Promise<Settings | undefined>;
  upsertSetting(setting: InsertSettings): Promise<Settings>;
  
  // Activity log operations
  getActivityLog(userId?: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // User Dashboard operations
  getUserDashboardStats(userId: string): Promise<UserDashboardStats>;
  getUserRenders(userId: string): Promise<RenderWithDetails[]>;
  getUserQuizResponses(userId: string): Promise<QuizResponse[]>;
  getUserCartItems(userId: string): Promise<CartItemWithProduct[]>;
  getUserOrders(userId: string): Promise<OrderWithItems[]>;
  getOrderById(orderId: string, userId: string): Promise<OrderWithItems | undefined>;
  
  // Saved Designs operations
  getSavedDesigns(userId: string): Promise<SavedDesign[]>;
  getSavedDesignById(id: string, userId: string): Promise<SavedDesign | undefined>;
  getSavedDesignByShareToken(shareToken: string): Promise<SavedDesign | undefined>;
  createSavedDesign(design: InsertSavedDesign): Promise<SavedDesign>;
  updateSavedDesign(id: string, userId: string, updates: Partial<InsertSavedDesign>): Promise<SavedDesign>;
  deleteSavedDesign(id: string, userId: string): Promise<void>;
  isRenderSaved(userId: string, renderId: string): Promise<boolean>;
  
  // Product Interactions operations
  createProductInteraction(interaction: InsertProductInteraction): Promise<ProductInteraction>;
  getUserProductInteractions(userId: string): Promise<ProductInteraction[]>;
  
  // Session to User data migration
  migrateSessionDataToUser(sessionId: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await getDb().insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
    } else {
      const [newUser] = await getDb()
        .insert(users)
        .values(userData)
        .returning();
      return newUser;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return getDb().select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await getDb()
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await getDb().delete(users).where(eq(users.id, id));
  }

  // Content operations
  async getAllContent(): Promise<Content[]> {
    return getDb().select().from(content).orderBy(desc(content.createdAt));
  }

  async getContent(id: string): Promise<Content | undefined> {
    const [item] = await getDb().select().from(content).where(eq(content.id, id));
    return item;
  }

  async createContent(contentData: InsertContent): Promise<Content> {
    const [item] = await getDb().insert(content).values(contentData).returning();
    return item;
  }

  async updateContent(id: string, contentData: Partial<InsertContent>): Promise<Content> {
    const [item] = await getDb()
      .update(content)
      .set({ ...contentData, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return item;
  }

  async deleteContent(id: string): Promise<void> {
    await getDb().delete(content).where(eq(content.id, id));
  }

  // Settings operations
  async getAllSettings(): Promise<Settings[]> {
    return getDb().select().from(settings);
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    const [setting] = await getDb().select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async upsertSetting(settingData: InsertSettings): Promise<Settings> {
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
  async getActivityLog(userId?: string): Promise<ActivityLog[]> {
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

  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await getDb().insert(activityLog).values(logData).returning();
    return log;
  }

  // User Dashboard operations
  async getUserDashboardStats(userId: string): Promise<UserDashboardStats> {
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
        total: sql<string>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(orders)
      .where(and(
        eq(orders.userId, userId),
        or(eq(orders.status, 'paid'), eq(orders.status, 'fulfilled'), eq(orders.status, 'shipped'), eq(orders.status, 'delivered'))
      ));

    return {
      totalRenders: renderCount?.count || 0,
      savedDesigns: savedCount?.count || 0,
      cartItems: cartCount?.count || 0,
      completedOrders: orderStats?.count || 0,
      totalSpent: orderStats?.total || '0',
    };
  }

  async getUserRenders(userId: string): Promise<RenderWithDetails[]> {
    const userRenders = await getDb()
      .select()
      .from(renders)
      .where(eq(renders.userId, userId))
      .orderBy(desc(renders.createdAt));
    
    const rendersWithDetails: RenderWithDetails[] = [];
    
    for (const render of userRenders) {
      const [quiz] = await getDb()
        .select()
        .from(quizResponses)
        .where(eq(quizResponses.id, render.quizResponseId));
      
      const [saved] = await getDb()
        .select()
        .from(savedDesigns)
        .where(and(
          eq(savedDesigns.userId, userId),
          eq(savedDesigns.renderId, render.id)
        ));
      
      rendersWithDetails.push({
        ...render,
        quizResponse: quiz,
        savedDesign: saved || null,
      });
    }
    
    return rendersWithDetails;
  }

  async getUserQuizResponses(userId: string): Promise<QuizResponse[]> {
    return getDb()
      .select()
      .from(quizResponses)
      .where(eq(quizResponses.userId, userId))
      .orderBy(desc(quizResponses.createdAt));
  }

  async getUserCartItems(userId: string): Promise<CartItemWithProduct[]> {
    const items = await getDb()
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));
    
    const itemsWithProducts: CartItemWithProduct[] = [];
    
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

  async getUserOrders(userId: string): Promise<OrderWithItems[]> {
    const userOrders = await getDb()
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
    
    const ordersWithItems: OrderWithItems[] = [];
    
    for (const order of userOrders) {
      const items = await getDb()
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      
      const itemsWithProducts: (OrderItem & { product: Product })[] = [];
      
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

  async getOrderById(orderId: string, userId: string): Promise<OrderWithItems | undefined> {
    const [order] = await getDb()
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
    
    if (!order) return undefined;
    
    const items = await getDb()
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    
    const itemsWithProducts: (OrderItem & { product: Product })[] = [];
    
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
  async getSavedDesigns(userId: string): Promise<SavedDesign[]> {
    return getDb()
      .select()
      .from(savedDesigns)
      .where(eq(savedDesigns.userId, userId))
      .orderBy(desc(savedDesigns.createdAt));
  }

  async getSavedDesignById(id: string, userId: string): Promise<SavedDesign | undefined> {
    const [design] = await getDb()
      .select()
      .from(savedDesigns)
      .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)));
    return design;
  }

  async getSavedDesignByShareToken(shareToken: string): Promise<SavedDesign | undefined> {
    const [design] = await getDb()
      .select()
      .from(savedDesigns)
      .where(eq(savedDesigns.shareToken, shareToken));
    return design;
  }

  async createSavedDesign(design: InsertSavedDesign): Promise<SavedDesign> {
    const [saved] = await getDb().insert(savedDesigns).values(design).returning();
    return saved;
  }

  async updateSavedDesign(id: string, userId: string, updates: Partial<InsertSavedDesign>): Promise<SavedDesign> {
    const [design] = await getDb()
      .update(savedDesigns)
      .set(updates)
      .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)))
      .returning();
    return design;
  }

  async deleteSavedDesign(id: string, userId: string): Promise<void> {
    await getDb()
      .delete(savedDesigns)
      .where(and(eq(savedDesigns.id, id), eq(savedDesigns.userId, userId)));
  }

  async isRenderSaved(userId: string, renderId: string): Promise<boolean> {
    const [design] = await getDb()
      .select()
      .from(savedDesigns)
      .where(and(eq(savedDesigns.userId, userId), eq(savedDesigns.renderId, renderId)));
    return !!design;
  }

  // Product Interactions operations
  async createProductInteraction(interaction: InsertProductInteraction): Promise<ProductInteraction> {
    const [created] = await getDb().insert(productInteractions).values(interaction).returning();
    return created;
  }

  async getUserProductInteractions(userId: string): Promise<ProductInteraction[]> {
    return getDb()
      .select()
      .from(productInteractions)
      .where(eq(productInteractions.userId, userId))
      .orderBy(desc(productInteractions.createdAt))
      .limit(100);
  }

  // Session to User data migration - links existing session data to authenticated user
  async migrateSessionDataToUser(sessionId: string, userId: string): Promise<void> {
    await getDb()
      .update(quizResponses)
      .set({ userId })
      .where(and(eq(quizResponses.sessionId, sessionId), sql`${quizResponses.userId} IS NULL`));
    
    await getDb()
      .update(renders)
      .set({ userId })
      .where(and(eq(renders.sessionId, sessionId), sql`${renders.userId} IS NULL`));
    
    await getDb()
      .update(cartItems)
      .set({ userId })
      .where(and(eq(cartItems.sessionId, sessionId), sql`${cartItems.userId} IS NULL`));
    
    await getDb()
      .update(orders)
      .set({ userId })
      .where(and(eq(orders.sessionId, sessionId), sql`${orders.userId} IS NULL`));
  }
}

export const storage = new DatabaseStorage();
