import {
  categories,
  suppliers,
  products,
  quizResponses,
  renders,
  selectionLedger,
  cartItems,
  orders,
  orderItems,
  users,
  designExamples,
  productPackages,
  placementGuidelines,
  designRules,
  uploadJobs,
  uploadJobFiles,
  visualAnalysisJobs,
  visualAnalysisProducts,
  renderProducts,
  renderEvents,
  documentationSections,
  documentationComments,
  type Category,
  type InsertCategory,
  type Supplier,
  type InsertSupplier,
  type Product,
  type InsertProduct,
  type QuizResponse,
  type InsertQuizResponse,
  type Render,
  type InsertRender,
  type SelectionLedger,
  type InsertSelectionLedger,
  type CartItem,
  type InsertCartItem,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type User,
  type DesignExample,
  type InsertDesignExample,
  type ProductPackage,
  type InsertProductPackage,
  type PlacementGuideline,
  type InsertPlacementGuideline,
  type DesignRule,
  type InsertDesignRule,
  type UploadJob,
  type InsertUploadJob,
  type UploadJobFile,
  type InsertUploadJobFile,
  type VisualAnalysisJob,
  type InsertVisualAnalysisJob,
  type VisualAnalysisProduct,
  type InsertVisualAnalysisProduct,
  type RenderProduct,
  type InsertRenderProduct,
  type RenderEvent,
  type InsertRenderEvent,
  type DocumentationSection,
  type InsertDocumentationSection,
  type DocumentationComment,
  type InsertDocumentationComment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, isNull, isNotNull, asc, sql } from "drizzle-orm";

export interface ICuralinaStorage {
  // Category operations
  getAllCategories(): Promise<Category[]>;
  getCategoriesByType(type: "room" | "furniture"): Promise<Category[]>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  
  // Supplier operations
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
  
  // Product operations
  getAllProducts(filters?: {
    categoryId?: string;
    styleTags?: string[];
  }): Promise<Product[]>;
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductAlternatives(productId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  setProductImageHealthStatus(id: string, status: 'healthy' | 'repairing' | 'removed', metadata?: any): Promise<Product>;
  
  // NEW: Structured analysis operations
  updateProductStructuredAnalysis(
    id: string,
    structuredAnalysis: any,
    qualityScore: number
  ): Promise<Product>;
  getProductsByAnalysisQuality(minScore: number, limit?: number): Promise<Product[]>;
  getProductsNeedingAnalysisRefinement(maxScore: number, limit?: number): Promise<Product[]>;
  getAnalysisStatistics(): Promise<{
    totalAnalyzed: number;
    averageQuality: number;
    qualityDistribution: Record<string, number>;
  }>;
  
  // Quiz operations
  createQuizResponse(quiz: InsertQuizResponse): Promise<QuizResponse>;
  getQuizResponse(id: string): Promise<QuizResponse | undefined>;
  
  // Render operations
  createRender(render: InsertRender): Promise<Render>;
  updateRender(id: string, data: Partial<InsertRender>): Promise<Render>;
  getRender(id: string): Promise<Render | undefined>;
  getLatestRenderBySession(sessionId: string): Promise<Render | undefined>;
  getRendersBySession(sessionId: string): Promise<Render[]>;
  
  // Selection Ledger operations
  createSelectionLedger(ledger: InsertSelectionLedger): Promise<SelectionLedger>;
  getSelectionLedgerByHash(hash: string): Promise<SelectionLedger | undefined>;
  getSelectionLedgerByRender(renderId: string): Promise<SelectionLedger | undefined>;
  getAllLedgers(limit?: number): Promise<SelectionLedger[]>;
  updateSelectionLedgerDetails(id: string, details: {
    selectionRationale?: any;
    compositionOrder?: string[];
    diversityScore?: number;
  }): Promise<SelectionLedger>;
  lockSelectionLedger(id: string): Promise<SelectionLedger>;
  deleteSelectionLedger(id: string): Promise<void>;
  
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
  
  // AI Training Data operations
  // Design Examples
  getAllDesignExamples(filters?: { type?: 'good' | 'bad'; roomType?: string }): Promise<DesignExample[]>;
  getDesignExample(id: string): Promise<DesignExample | undefined>;
  createDesignExample(example: InsertDesignExample): Promise<DesignExample>;
  updateDesignExample(id: string, example: Partial<InsertDesignExample>): Promise<DesignExample>;
  deleteDesignExample(id: string): Promise<void>;
  
  // Product Packages
  getAllProductPackages(filters?: { roomType?: string; active?: boolean }): Promise<ProductPackage[]>;
  getProductPackage(id: string): Promise<ProductPackage | undefined>;
  createProductPackage(pkg: InsertProductPackage): Promise<ProductPackage>;
  updateProductPackage(id: string, pkg: Partial<InsertProductPackage>): Promise<ProductPackage>;
  deleteProductPackage(id: string): Promise<void>;
  
  // Placement Guidelines
  getAllPlacementGuidelines(filters?: { roomType?: string; productCategory?: string }): Promise<PlacementGuideline[]>;
  getPlacementGuideline(id: string): Promise<PlacementGuideline | undefined>;
  createPlacementGuideline(guideline: InsertPlacementGuideline): Promise<PlacementGuideline>;
  updatePlacementGuideline(id: string, guideline: Partial<InsertPlacementGuideline>): Promise<PlacementGuideline>;
  deletePlacementGuideline(id: string): Promise<void>;
  
  // Design Rules
  getAllDesignRules(filters?: { category?: string; active?: boolean }): Promise<DesignRule[]>;
  getDesignRule(id: string): Promise<DesignRule | undefined>;
  createDesignRule(rule: InsertDesignRule): Promise<DesignRule>;
  updateDesignRule(id: string, rule: Partial<InsertDesignRule>): Promise<DesignRule>;
  deleteDesignRule(id: string): Promise<void>;
  
  // Upload Job operations
  createUploadJob(job: InsertUploadJob): Promise<UploadJob>;
  getUploadJob(id: string): Promise<UploadJob | undefined>;
  getUploadJobsByProduct(productId: string): Promise<UploadJob[]>;
  getActiveUploadJobs(userId?: string): Promise<UploadJob[]>;
  updateUploadJob(id: string, data: Partial<InsertUploadJob>): Promise<UploadJob>;
  deleteUploadJob(id: string): Promise<void>;
  
  // Upload Job File operations
  createUploadJobFile(file: InsertUploadJobFile): Promise<UploadJobFile>;
  createUploadJobFiles(files: InsertUploadJobFile[]): Promise<UploadJobFile[]>;
  getUploadJobFiles(jobId: string): Promise<UploadJobFile[]>;
  getPendingUploadJobFiles(jobId: string): Promise<UploadJobFile[]>;
  updateUploadJobFile(id: string, data: Partial<InsertUploadJobFile>): Promise<UploadJobFile>;
  deleteUploadJobFile(id: string): Promise<void>;
  
  // Visual Analysis Job operations
  createVisualAnalysisJob(job: InsertVisualAnalysisJob): Promise<VisualAnalysisJob>;
  getVisualAnalysisJob(id: string): Promise<VisualAnalysisJob | undefined>;
  getActiveVisualAnalysisJobs(userId?: string): Promise<VisualAnalysisJob[]>;
  updateVisualAnalysisJob(id: string, data: Partial<InsertVisualAnalysisJob>): Promise<VisualAnalysisJob>;
  deleteVisualAnalysisJob(id: string): Promise<void>;
  
  // Visual Analysis Product operations
  createVisualAnalysisProduct(product: InsertVisualAnalysisProduct): Promise<VisualAnalysisProduct>;
  createVisualAnalysisProducts(products: InsertVisualAnalysisProduct[]): Promise<VisualAnalysisProduct[]>;
  getVisualAnalysisProducts(jobId: string): Promise<VisualAnalysisProduct[]>;
  getPendingVisualAnalysisProducts(jobId: string, limit: number): Promise<VisualAnalysisProduct[]>;
  updateVisualAnalysisProduct(id: string, data: Partial<InsertVisualAnalysisProduct>): Promise<VisualAnalysisProduct>;
  deleteVisualAnalysisProduct(id: string): Promise<void>;
  upsertVisualAnalysisProducts(products: InsertVisualAnalysisProduct[]): Promise<void>;
  
  // Render Products operations
  createRenderProduct(product: InsertRenderProduct): Promise<RenderProduct>;
  createRenderProducts(products: InsertRenderProduct[]): Promise<RenderProduct[]>;
  getRenderProductsByRender(renderId: string): Promise<RenderProduct[]>;
  getRenderProduct(id: string): Promise<RenderProduct | undefined>;
  deleteRenderProductsByRender(renderId: string): Promise<void>;
  ingestRenderSnapshot(renderId: string, productsData: InsertRenderProduct[], events: InsertRenderEvent[]): Promise<void>;
  
  // Render Events operations
  createRenderEvent(event: InsertRenderEvent): Promise<RenderEvent>;
  getRenderEventsByRender(renderId: string): Promise<RenderEvent[]>;
  getRenderEventsByType(renderId: string, eventType: string): Promise<RenderEvent[]>;
  
  // Documentation Sections operations
  getAllDocumentationSections(filters?: { status?: string; slug?: string }): Promise<DocumentationSection[]>;
  getDocumentationSection(id: string): Promise<DocumentationSection | undefined>;
  getDocumentationSectionBySlug(slug: string, version?: number): Promise<DocumentationSection | undefined>;
  createDocumentationSection(section: InsertDocumentationSection): Promise<DocumentationSection>;
  updateDocumentationSection(id: string, section: Partial<InsertDocumentationSection>): Promise<DocumentationSection>;
  deleteDocumentationSection(id: string): Promise<void>;
  publishDocumentationSection(id: string): Promise<DocumentationSection>;
  
  // Documentation Comments operations
  getCommentsBySection(sectionId: string, filters?: { resolved?: boolean; isInternal?: boolean }): Promise<DocumentationComment[]>;
  getComment(id: string): Promise<DocumentationComment | undefined>;
  createComment(comment: InsertDocumentationComment): Promise<DocumentationComment>;
  updateComment(id: string, comment: Partial<InsertDocumentationComment>): Promise<DocumentationComment>;
  deleteComment(id: string): Promise<void>;
  resolveComment(id: string, userId: string): Promise<DocumentationComment>;
}

export class CuralinaStorage implements ICuralinaStorage {
  // Category operations
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoriesByType(type: "room" | "furniture"): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.type, type));
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category;
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(categoryData).returning();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Supplier operations
  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers);
  }

  async getSupplierByName(name: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.name, name));
    return supplier;
  }

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(supplierData).returning();
    return supplier;
  }

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
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

  async getProducts(): Promise<Product[]> {
    return db.select().from(products);
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

  async setProductImageHealthStatus(
    id: string,
    status: 'healthy' | 'repairing' | 'removed',
    metadata?: any
  ): Promise<Product> {
    // First, get the current product to preserve existing imageAnalyses
    const [existingProduct] = await db.select().from(products).where(eq(products.id, id));
    
    if (!existingProduct) {
      throw new Error("Product not found");
    }

    const updateData: any = {
      imageHealth: status,
      lastValidatedAt: new Date(),
    };

    // Merge metadata with existing imageAnalyses to preserve audit trail
    if (metadata) {
      const existingAnalyses = existingProduct.imageAnalyses || {};
      // Create health history array if it doesn't exist
      const healthHistory = (existingAnalyses as any).healthHistory || [];
      healthHistory.push({
        status,
        timestamp: new Date().toISOString(),
        ...metadata
      });
      
      updateData.imageAnalyses = {
        ...existingAnalyses,
        healthHistory,
        lastHealthAction: metadata
      };
    }

    const [product] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();
    
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // NEW: Structured analysis operations
  async updateProductStructuredAnalysis(
    id: string,
    structuredAnalysis: any,
    qualityScore: number
  ): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({
        structuredAnalysis,
        structuredAnalysisQuality: qualityScore,
        structuredAnalysisUpdatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    
    return product;
  }

  async getProductsByAnalysisQuality(minScore: number, limit?: number): Promise<Product[]> {
    let query = db
      .select()
      .from(products)
      .where(
        and(
          isNotNull(products.structuredAnalysisQuality),
          sql`${products.structuredAnalysisQuality} >= ${minScore}`
        )
      )
      .orderBy(desc(products.structuredAnalysisQuality));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  async getProductsNeedingAnalysisRefinement(maxScore: number, limit?: number): Promise<Product[]> {
    let query = db
      .select()
      .from(products)
      .where(
        and(
          isNotNull(products.structuredAnalysisQuality),
          sql`${products.structuredAnalysisQuality} < ${maxScore}`
        )
      )
      .orderBy(asc(products.structuredAnalysisQuality));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return query;
  }

  async getAnalysisStatistics(): Promise<{
    totalAnalyzed: number;
    averageQuality: number;
    qualityDistribution: Record<string, number>;
  }> {
    // Get all products with structured analysis
    const analyzedProducts = await db
      .select()
      .from(products)
      .where(isNotNull(products.structuredAnalysisQuality));
    
    if (analyzedProducts.length === 0) {
      return {
        totalAnalyzed: 0,
        averageQuality: 0,
        qualityDistribution: {},
      };
    }

    // Calculate statistics
    const qualityScores = analyzedProducts
      .map(p => p.structuredAnalysisQuality || 0)
      .filter(q => q > 0);
    
    const averageQuality = qualityScores.length > 0
      ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
      : 0;

    // Distribution by quality tiers
    const distribution: Record<string, number> = {
      'excellent_75_100': 0,
      'good_50_74': 0,
      'fair_25_49': 0,
      'poor_0_24': 0,
      'not_analyzed': 0,
    };

    for (const product of analyzedProducts) {
      const score = product.structuredAnalysisQuality || 0;
      if (score === 0) {
        distribution.not_analyzed++;
      } else if (score >= 75) {
        distribution.excellent_75_100++;
      } else if (score >= 50) {
        distribution.good_50_74++;
      } else if (score >= 25) {
        distribution.fair_25_49++;
      } else {
        distribution.poor_0_24++;
      }
    }

    return {
      totalAnalyzed: analyzedProducts.length,
      averageQuality,
      qualityDistribution: distribution,
    };
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

  // Selection Ledger operations
  async createSelectionLedger(ledgerData: InsertSelectionLedger): Promise<SelectionLedger> {
    const [ledger] = await db.insert(selectionLedger).values(ledgerData).returning();
    return ledger;
  }

  async getSelectionLedgerByHash(hash: string): Promise<SelectionLedger | undefined> {
    const [ledger] = await db
      .select()
      .from(selectionLedger)
      .where(eq(selectionLedger.selectionHash, hash))
      .limit(1);
    return ledger;
  }

  async getSelectionLedgerByRender(renderId: string): Promise<SelectionLedger | undefined> {
    const [ledger] = await db
      .select()
      .from(selectionLedger)
      .where(eq(selectionLedger.renderId, renderId))
      .limit(1);
    return ledger;
  }

  async getAllLedgers(limit: number = 100): Promise<SelectionLedger[]> {
    return db
      .select()
      .from(selectionLedger)
      .orderBy(desc(selectionLedger.createdAt))
      .limit(limit);
  }

  async updateSelectionLedgerDetails(id: string, details: {
    selectionRationale?: any;
    compositionOrder?: string[];
    diversityScore?: number;
  }): Promise<SelectionLedger> {
    const updateData: any = {};
    if (details.selectionRationale !== undefined) {
      updateData.selectionRationale = details.selectionRationale;
    }
    if (details.compositionOrder !== undefined) {
      updateData.compositionOrder = details.compositionOrder;
    }
    if (details.diversityScore !== undefined) {
      updateData.diversityScore = details.diversityScore;
    }
    
    const [ledger] = await db
      .update(selectionLedger)
      .set(updateData)
      .where(eq(selectionLedger.id, id))
      .returning();
    return ledger;
  }

  async lockSelectionLedger(id: string): Promise<SelectionLedger> {
    const [ledger] = await db
      .update(selectionLedger)
      .set({ lockedAt: new Date() })
      .where(eq(selectionLedger.id, id))
      .returning();
    return ledger;
  }

  async deleteSelectionLedger(id: string): Promise<void> {
    await db.delete(selectionLedger).where(eq(selectionLedger.id, id));
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

  // AI Training Data operations
  // Design Examples
  async getAllDesignExamples(filters?: { type?: 'good' | 'bad'; roomType?: string }): Promise<DesignExample[]> {
    let query = db.select().from(designExamples);
    
    const conditions = [];
    if (filters?.type) {
      conditions.push(eq(designExamples.type, filters.type));
    }
    if (filters?.roomType) {
      conditions.push(eq(designExamples.roomType, filters.roomType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(designExamples.createdAt));
  }

  async getDesignExample(id: string): Promise<DesignExample | undefined> {
    const [example] = await db.select().from(designExamples).where(eq(designExamples.id, id));
    return example;
  }

  async createDesignExample(exampleData: InsertDesignExample): Promise<DesignExample> {
    const [example] = await db.insert(designExamples).values(exampleData).returning();
    return example;
  }

  async updateDesignExample(id: string, exampleData: Partial<InsertDesignExample>): Promise<DesignExample> {
    const [example] = await db
      .update(designExamples)
      .set({ ...exampleData, updatedAt: new Date() })
      .where(eq(designExamples.id, id))
      .returning();
    return example;
  }

  async deleteDesignExample(id: string): Promise<void> {
    await db.delete(designExamples).where(eq(designExamples.id, id));
  }

  // Product Packages
  async getAllProductPackages(filters?: { roomType?: string; active?: boolean }): Promise<ProductPackage[]> {
    let query = db.select().from(productPackages);
    
    const conditions = [];
    if (filters?.roomType) {
      conditions.push(eq(productPackages.roomType, filters.roomType));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(productPackages.active, filters.active));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(productPackages.createdAt));
  }

  async getProductPackage(id: string): Promise<ProductPackage | undefined> {
    const [pkg] = await db.select().from(productPackages).where(eq(productPackages.id, id));
    return pkg;
  }

  async createProductPackage(pkgData: InsertProductPackage): Promise<ProductPackage> {
    const [pkg] = await db.insert(productPackages).values(pkgData).returning();
    return pkg;
  }

  async updateProductPackage(id: string, pkgData: Partial<InsertProductPackage>): Promise<ProductPackage> {
    const [pkg] = await db
      .update(productPackages)
      .set({ ...pkgData, updatedAt: new Date() })
      .where(eq(productPackages.id, id))
      .returning();
    return pkg;
  }

  async deleteProductPackage(id: string): Promise<void> {
    await db.delete(productPackages).where(eq(productPackages.id, id));
  }

  // Placement Guidelines
  async getAllPlacementGuidelines(filters?: { roomType?: string; productCategory?: string }): Promise<PlacementGuideline[]> {
    let query = db.select().from(placementGuidelines);
    
    const conditions = [];
    if (filters?.roomType) {
      conditions.push(eq(placementGuidelines.roomType, filters.roomType));
    }
    if (filters?.productCategory) {
      conditions.push(eq(placementGuidelines.productCategory, filters.productCategory));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(placementGuidelines.priority), desc(placementGuidelines.createdAt));
  }

  async getPlacementGuideline(id: string): Promise<PlacementGuideline | undefined> {
    const [guideline] = await db.select().from(placementGuidelines).where(eq(placementGuidelines.id, id));
    return guideline;
  }

  async createPlacementGuideline(guidelineData: InsertPlacementGuideline): Promise<PlacementGuideline> {
    const [guideline] = await db.insert(placementGuidelines).values(guidelineData).returning();
    return guideline;
  }

  async updatePlacementGuideline(id: string, guidelineData: Partial<InsertPlacementGuideline>): Promise<PlacementGuideline> {
    const [guideline] = await db
      .update(placementGuidelines)
      .set({ ...guidelineData, updatedAt: new Date() })
      .where(eq(placementGuidelines.id, id))
      .returning();
    return guideline;
  }

  async deletePlacementGuideline(id: string): Promise<void> {
    await db.delete(placementGuidelines).where(eq(placementGuidelines.id, id));
  }

  // Design Rules
  async getAllDesignRules(filters?: { category?: string; active?: boolean }): Promise<DesignRule[]> {
    let query = db.select().from(designRules);
    
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(designRules.category, filters.category));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(designRules.active, filters.active));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(designRules.priority), desc(designRules.createdAt));
  }

  async getDesignRule(id: string): Promise<DesignRule | undefined> {
    const [rule] = await db.select().from(designRules).where(eq(designRules.id, id));
    return rule;
  }

  async createDesignRule(ruleData: InsertDesignRule): Promise<DesignRule> {
    const [rule] = await db.insert(designRules).values(ruleData).returning();
    return rule;
  }

  async updateDesignRule(id: string, ruleData: Partial<InsertDesignRule>): Promise<DesignRule> {
    const [rule] = await db
      .update(designRules)
      .set({ ...ruleData, updatedAt: new Date() })
      .where(eq(designRules.id, id))
      .returning();
    return rule;
  }

  async deleteDesignRule(id: string): Promise<void> {
    await db.delete(designRules).where(eq(designRules.id, id));
  }

  // Upload Job operations
  async createUploadJob(jobData: InsertUploadJob): Promise<UploadJob> {
    const [job] = await db.insert(uploadJobs).values(jobData).returning();
    return job;
  }

  async getUploadJob(id: string): Promise<UploadJob | undefined> {
    const [job] = await db.select().from(uploadJobs).where(eq(uploadJobs.id, id));
    return job;
  }

  async getUploadJobsByProduct(productId: string): Promise<UploadJob[]> {
    return db.select().from(uploadJobs).where(eq(uploadJobs.productId, productId)).orderBy(desc(uploadJobs.createdAt));
  }

  async getActiveUploadJobs(userId?: string): Promise<UploadJob[]> {
    const conditions = [inArray(uploadJobs.status, ["pending", "processing"])];
    if (userId) {
      conditions.push(eq(uploadJobs.userId, userId));
    }
    return db.select().from(uploadJobs).where(and(...conditions)).orderBy(desc(uploadJobs.createdAt));
  }

  async updateUploadJob(id: string, data: Partial<InsertUploadJob>): Promise<UploadJob> {
    const [job] = await db
      .update(uploadJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(uploadJobs.id, id))
      .returning();
    return job;
  }

  async deleteUploadJob(id: string): Promise<void> {
    await db.delete(uploadJobs).where(eq(uploadJobs.id, id));
  }

  // Upload Job File operations
  async createUploadJobFile(fileData: InsertUploadJobFile): Promise<UploadJobFile> {
    const [file] = await db.insert(uploadJobFiles).values(fileData).returning();
    return file;
  }

  async createUploadJobFiles(filesData: InsertUploadJobFile[]): Promise<UploadJobFile[]> {
    return db.insert(uploadJobFiles).values(filesData).returning();
  }

  async getUploadJobFiles(jobId: string): Promise<UploadJobFile[]> {
    return db.select().from(uploadJobFiles).where(eq(uploadJobFiles.jobId, jobId));
  }

  async getPendingUploadJobFiles(jobId: string): Promise<UploadJobFile[]> {
    return db.select().from(uploadJobFiles).where(
      and(
        eq(uploadJobFiles.jobId, jobId),
        inArray(uploadJobFiles.status, ["pending", "failed"])
      )
    );
  }

  async updateUploadJobFile(id: string, data: Partial<InsertUploadJobFile>): Promise<UploadJobFile> {
    const [file] = await db
      .update(uploadJobFiles)
      .set(data)
      .where(eq(uploadJobFiles.id, id))
      .returning();
    return file;
  }

  async deleteUploadJobFile(id: string): Promise<void> {
    await db.delete(uploadJobFiles).where(eq(uploadJobFiles.id, id));
  }
  
  // Visual Analysis Job operations
  async createVisualAnalysisJob(jobData: InsertVisualAnalysisJob): Promise<VisualAnalysisJob> {
    const [job] = await db.insert(visualAnalysisJobs).values(jobData).returning();
    return job;
  }

  async getVisualAnalysisJob(id: string): Promise<VisualAnalysisJob | undefined> {
    const [job] = await db.select().from(visualAnalysisJobs).where(eq(visualAnalysisJobs.id, id));
    return job;
  }

  async getActiveVisualAnalysisJobs(userId?: string): Promise<VisualAnalysisJob[]> {
    const conditions = [inArray(visualAnalysisJobs.status, ["pending", "processing"])];
    if (userId) {
      conditions.push(eq(visualAnalysisJobs.userId, userId));
    }
    return db.select().from(visualAnalysisJobs).where(and(...conditions)).orderBy(desc(visualAnalysisJobs.createdAt));
  }

  async updateVisualAnalysisJob(id: string, data: Partial<InsertVisualAnalysisJob>): Promise<VisualAnalysisJob> {
    const [job] = await db
      .update(visualAnalysisJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visualAnalysisJobs.id, id))
      .returning();
    return job;
  }

  async deleteVisualAnalysisJob(id: string): Promise<void> {
    await db.delete(visualAnalysisJobs).where(eq(visualAnalysisJobs.id, id));
  }
  
  // Visual Analysis Product operations
  async createVisualAnalysisProduct(productData: InsertVisualAnalysisProduct): Promise<VisualAnalysisProduct> {
    const [product] = await db.insert(visualAnalysisProducts).values(productData).returning();
    return product;
  }

  async createVisualAnalysisProducts(productsData: InsertVisualAnalysisProduct[]): Promise<VisualAnalysisProduct[]> {
    if (productsData.length === 0) return [];
    return db.insert(visualAnalysisProducts).values(productsData).returning();
  }

  async getVisualAnalysisProducts(jobId: string): Promise<VisualAnalysisProduct[]> {
    return db.select().from(visualAnalysisProducts).where(eq(visualAnalysisProducts.jobId, jobId));
  }

  async getPendingVisualAnalysisProducts(jobId: string, limit: number): Promise<VisualAnalysisProduct[]> {
    return db
      .select()
      .from(visualAnalysisProducts)
      .where(
        and(
          eq(visualAnalysisProducts.jobId, jobId),
          eq(visualAnalysisProducts.status, "pending")
        )
      )
      .limit(limit);
  }

  async updateVisualAnalysisProduct(id: string, data: Partial<InsertVisualAnalysisProduct>): Promise<VisualAnalysisProduct> {
    const [product] = await db
      .update(visualAnalysisProducts)
      .set(data)
      .where(eq(visualAnalysisProducts.id, id))
      .returning();
    return product;
  }

  async deleteVisualAnalysisProduct(id: string): Promise<void> {
    await db.delete(visualAnalysisProducts).where(eq(visualAnalysisProducts.id, id));
  }
  
  async upsertVisualAnalysisProducts(productsData: InsertVisualAnalysisProduct[]): Promise<void> {
    if (productsData.length === 0) return;
    
    // Use transaction for batch upsert
    await db.transaction(async (tx) => {
      for (const product of productsData) {
        await tx
          .insert(visualAnalysisProducts)
          .values(product)
          .onConflictDoUpdate({
            target: [visualAnalysisProducts.jobId, visualAnalysisProducts.productId],
            set: {
              status: product.status,
              productSku: product.productSku,
              productName: product.productName,
            },
          });
      }
    });
  }
  
  // Render Products operations
  async createRenderProduct(productData: InsertRenderProduct): Promise<RenderProduct> {
    const [product] = await db.insert(renderProducts).values(productData).returning();
    return product;
  }

  async createRenderProducts(productsData: InsertRenderProduct[]): Promise<RenderProduct[]> {
    if (productsData.length === 0) return [];
    return db.insert(renderProducts).values(productsData).returning();
  }

  async getRenderProductsByRender(renderId: string): Promise<RenderProduct[]> {
    return db.select().from(renderProducts).where(eq(renderProducts.renderId, renderId));
  }

  async getRenderProduct(id: string): Promise<RenderProduct | undefined> {
    const [product] = await db.select().from(renderProducts).where(eq(renderProducts.id, id));
    return product;
  }

  async deleteRenderProductsByRender(renderId: string): Promise<void> {
    await db.delete(renderProducts).where(eq(renderProducts.renderId, renderId));
  }

  async ingestRenderSnapshot(
    renderId: string,
    productsData: InsertRenderProduct[],
    eventsData: InsertRenderEvent[]
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(renderProducts).where(eq(renderProducts.renderId, renderId));
      await tx.delete(renderEvents).where(eq(renderEvents.renderId, renderId));
      
      if (productsData.length > 0) {
        await tx.insert(renderProducts).values(productsData);
      }
      
      if (eventsData.length > 0) {
        await tx.insert(renderEvents).values(eventsData);
      }
    });
  }
  
  // Render Events operations
  async createRenderEvent(eventData: InsertRenderEvent): Promise<RenderEvent> {
    const [event] = await db.insert(renderEvents).values(eventData).returning();
    return event;
  }

  async getRenderEventsByRender(renderId: string): Promise<RenderEvent[]> {
    return db.select().from(renderEvents).where(eq(renderEvents.renderId, renderId)).orderBy(desc(renderEvents.occurredAt));
  }

  async getRenderEventsByType(renderId: string, eventType: string): Promise<RenderEvent[]> {
    return db
      .select()
      .from(renderEvents)
      .where(and(eq(renderEvents.renderId, renderId), eq(renderEvents.eventType, eventType)))
      .orderBy(desc(renderEvents.occurredAt));
  }
  
  // Documentation Sections operations
  async getAllDocumentationSections(filters?: { status?: string; slug?: string }): Promise<DocumentationSection[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(documentationSections.status, filters.status));
    }
    if (filters?.slug) {
      conditions.push(eq(documentationSections.slug, filters.slug));
    }
    
    if (conditions.length === 0) {
      return db.select().from(documentationSections).orderBy(documentationSections.sortOrder);
    }
    
    return db.select().from(documentationSections).where(and(...conditions)).orderBy(documentationSections.sortOrder);
  }

  async getDocumentationSection(id: string): Promise<DocumentationSection | undefined> {
    const [section] = await db.select().from(documentationSections).where(eq(documentationSections.id, id));
    return section;
  }

  async getDocumentationSectionBySlug(slug: string, version?: number): Promise<DocumentationSection | undefined> {
    const conditions = [eq(documentationSections.slug, slug)];
    if (version !== undefined) {
      conditions.push(eq(documentationSections.version, version));
    }
    
    const [section] = await db
      .select()
      .from(documentationSections)
      .where(and(...conditions))
      .orderBy(desc(documentationSections.version))
      .limit(1);
    return section;
  }

  async createDocumentationSection(sectionData: InsertDocumentationSection): Promise<DocumentationSection> {
    const [section] = await db.insert(documentationSections).values(sectionData).returning();
    return section;
  }

  async updateDocumentationSection(id: string, sectionData: Partial<InsertDocumentationSection>): Promise<DocumentationSection> {
    const [section] = await db
      .update(documentationSections)
      .set({ ...sectionData, updatedAt: new Date() })
      .where(eq(documentationSections.id, id))
      .returning();
    return section;
  }

  async deleteDocumentationSection(id: string): Promise<void> {
    await db.delete(documentationSections).where(eq(documentationSections.id, id));
  }

  async publishDocumentationSection(id: string): Promise<DocumentationSection> {
    const section = await this.getDocumentationSection(id);
    if (!section) {
      throw new Error('Section not found');
    }
    
    const [updated] = await db
      .update(documentationSections)
      .set({
        status: 'published',
        publishedVersion: section.version,
        updatedAt: new Date(),
      })
      .where(eq(documentationSections.id, id))
      .returning();
    return updated;
  }
  
  // Documentation Comments operations
  async getCommentsBySection(sectionId: string, filters?: { resolved?: boolean; isInternal?: boolean }): Promise<DocumentationComment[]> {
    const conditions = [eq(documentationComments.sectionId, sectionId)];
    
    if (filters?.resolved !== undefined) {
      if (filters.resolved) {
        conditions.push(isNotNull(documentationComments.resolvedAt));
      } else {
        conditions.push(isNull(documentationComments.resolvedAt));
      }
    }
    
    if (filters?.isInternal !== undefined) {
      conditions.push(eq(documentationComments.isInternal, filters.isInternal));
    }
    
    return db
      .select()
      .from(documentationComments)
      .where(and(...conditions))
      .orderBy(desc(documentationComments.createdAt));
  }

  async getComment(id: string): Promise<DocumentationComment | undefined> {
    const [comment] = await db.select().from(documentationComments).where(eq(documentationComments.id, id));
    return comment;
  }

  async createComment(commentData: InsertDocumentationComment): Promise<DocumentationComment> {
    const [comment] = await db.insert(documentationComments).values(commentData).returning();
    return comment;
  }

  async updateComment(id: string, commentData: Partial<InsertDocumentationComment>): Promise<DocumentationComment> {
    const [comment] = await db
      .update(documentationComments)
      .set({ ...commentData, editedAt: new Date() })
      .where(eq(documentationComments.id, id))
      .returning();
    return comment;
  }

  async deleteComment(id: string): Promise<void> {
    await db.delete(documentationComments).where(eq(documentationComments.id, id));
  }

  async resolveComment(id: string, userId: string): Promise<DocumentationComment> {
    const [comment] = await db
      .update(documentationComments)
      .set({
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(eq(documentationComments.id, id))
      .returning();
    return comment;
  }
}

export const curalinaStorage = new CuralinaStorage();
