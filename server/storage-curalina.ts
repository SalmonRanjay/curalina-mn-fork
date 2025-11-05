import {
  categories,
  vendors,
  products,
  quizResponses,
  renders,
  cartItems,
  orders,
  orderItems,
  users,
  type Category,
  type InsertCategory,
  type Vendor,
  type InsertVendor,
  type Product,
  type InsertProduct,
  type QuizResponse,
  type InsertQuizResponse,
  type Render,
  type InsertRender,
  type CartItem,
  type InsertCartItem,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc } from "drizzle-orm";

export interface ICuralinaStorage {
  // Category operations
  getAllCategories(): Promise<Category[]>;
  getCategoriesByType(type: "room" | "furniture"): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  
  // Vendor operations
  getAllVendors(): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;
  
  // Product operations
  getAllProducts(filters?: {
    categoryId?: string;
    styleTags?: string[];
  }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductAlternatives(productId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Quiz operations
  createQuizResponse(quiz: InsertQuizResponse): Promise<QuizResponse>;
  getQuizResponse(id: string): Promise<QuizResponse | undefined>;
  
  // Render operations
  createRender(render: InsertRender): Promise<Render>;
  updateRender(id: string, data: Partial<InsertRender>): Promise<Render>;
  getRender(id: string): Promise<Render | undefined>;
  getLatestRenderBySession(sessionId: string): Promise<Render | undefined>;
  getRendersBySession(sessionId: string): Promise<Render[]>;
  
  // Cart operations
  getCartBySession(sessionId: string): Promise<Array<CartItem & { product: Product }>>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem>;
  removeFromCart(id: string): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
  
  // Order operations
  createOrder(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersBySession(sessionId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  
  // User operations
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User>;
  
  // Admin operations
  getAllRenders(): Promise<Render[]>;
  getAllQuizResponses(): Promise<QuizResponse[]>;
}

export class CuralinaStorage implements ICuralinaStorage {
  // Category operations
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoriesByType(type: "room" | "furniture"): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.type, type));
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(categoryData).returning();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Vendor operations
  async getAllVendors(): Promise<Vendor[]> {
    return db.select().from(vendors);
  }

  async createVendor(vendorData: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(vendorData).returning();
    return vendor;
  }

  async deleteVendor(id: string): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // Product operations
  async getAllProducts(filters?: {
    categoryId?: string;
    styleTags?: string[];
  }): Promise<Product[]> {
    let query = db.select().from(products);
    
    const conditions = [];
    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query;
    
    // Filter by style tags if provided
    if (filters?.styleTags && filters.styleTags.length > 0) {
      return results.filter(product => 
        product.styleTags?.some(tag => filters.styleTags?.includes(tag))
      );
    }
    
    return results;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async getProductAlternatives(productId: string): Promise<Product[]> {
    const product = await this.getProduct(productId);
    if (!product) return [];
    
    // Find products with same category and overlapping style tags
    const alternatives = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, product.categoryId!))
      .limit(7); // Get 7 to filter out the original product
    
    return alternatives
      .filter(p => 
        p.id !== productId && 
        p.styleTags?.some(tag => product.styleTags?.includes(tag))
      )
      .slice(0, 6);
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(productData).returning();
    return product;
  }

  async updateProduct(id: string, productData: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Quiz operations
  async createQuizResponse(quizData: InsertQuizResponse): Promise<QuizResponse> {
    const [quiz] = await db.insert(quizResponses).values(quizData).returning();
    return quiz;
  }

  async getQuizResponse(id: string): Promise<QuizResponse | undefined> {
    const [quiz] = await db.select().from(quizResponses).where(eq(quizResponses.id, id));
    return quiz;
  }

  // Render operations
  async createRender(renderData: InsertRender): Promise<Render> {
    const [render] = await db.insert(renders).values(renderData).returning();
    return render;
  }

  async updateRender(id: string, data: Partial<InsertRender>): Promise<Render> {
    const [render] = await db
      .update(renders)
      .set(data)
      .where(eq(renders.id, id))
      .returning();
    return render;
  }

  async getRender(id: string): Promise<Render | undefined> {
    const [render] = await db.select().from(renders).where(eq(renders.id, id));
    return render;
  }

  async getLatestRenderBySession(sessionId: string): Promise<Render | undefined> {
    const [render] = await db
      .select()
      .from(renders)
      .where(eq(renders.sessionId, sessionId))
      .orderBy(desc(renders.createdAt))
      .limit(1);
    return render;
  }

  async getRendersBySession(sessionId: string): Promise<Render[]> {
    return db
      .select()
      .from(renders)
      .where(eq(renders.sessionId, sessionId))
      .orderBy(desc(renders.createdAt));
  }

  // Cart operations
  async getCartBySession(sessionId: string): Promise<Array<CartItem & { product: Product }>> {
    const items = await db
      .select({
        cartItem: cartItems,
        product: products,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.sessionId, sessionId));
    
    return items.map(({ cartItem, product }) => ({
      ...cartItem,
      product,
    }));
  }

  async addToCart(itemData: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.sessionId, itemData.sessionId),
          eq(cartItems.productId, itemData.productId)
        )
      );
    
    if (existing) {
      // Update quantity
      const newQuantity = existing.quantity + (itemData.quantity || 1);
      const [updated] = await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    }
    
    // Create new cart item
    const [item] = await db.insert(cartItems).values(itemData).returning();
    return item;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem> {
    const [item] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return item;
  }

  async removeFromCart(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  // Order operations
  async createOrder(orderData: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order> {
    const [order] = await db.insert(orders).values(orderData).returning();
    
    // Create order items
    if (items.length > 0) {
      const orderItemsData = items.map(item => ({
        ...item,
        orderId: order.id,
      }));
      await db.insert(orderItems).values(orderItemsData);
    }
    
    return order;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersBySession(sessionId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.sessionId, sessionId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // User operations
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Admin operations
  async getAllRenders(): Promise<Render[]> {
    return db.select().from(renders).orderBy(desc(renders.createdAt));
  }

  async getAllQuizResponses(): Promise<QuizResponse[]> {
    return db.select().from(quizResponses).orderBy(desc(quizResponses.createdAt));
  }
}

export const curalinaStorage = new CuralinaStorage();
