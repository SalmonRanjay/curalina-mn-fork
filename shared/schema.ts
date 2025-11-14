import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(), // Hashed password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"), // 'admin' or 'user'
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User insert schema for registration
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Content management table (for admin to manage website content)
export const content = pgTable("content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  body: text("body"),
  imageUrl: text("image_url"),
  category: varchar("category").notNull().default("general"), // 'feature', 'testimonial', 'general'
  published: boolean("published").notNull().default(false),
  authorId: varchar("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentRelations = relations(content, ({ one }) => ({
  author: one(users, {
    fields: [content.authorId],
    references: [users.id],
  }),
}));

export const insertContentSchema = createInsertSchema(content).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof content.$inferSelect;

// Settings table (for admin to configure the app)
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Activity log table (for tracking user and admin actions)
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

// ===== CURALINA AI SCHEMA =====

// Categories - Product categorization (room types and furniture types)
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'room' or 'furniture'
  slug: varchar("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// Suppliers - Furniture suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Supplier = typeof suppliers.$inferSelect;
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

// Products - Full product catalog
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: varchar("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id),
  
  // Pricing
  tradePrice: decimal("trade_price", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  
  // Product attributes
  roomType: text("room_type").array(), // ['Living room', 'Bedroom']
  designStyle: text("design_style").array(), // ['Modern', 'Contemporary']
  styleTags: text("style_tags").array(), // ['modern', 'organic']
  keyFeatures: text("key_features").array(), // ['pet-friendly', 'casual setting']
  storageSolutions: text("storage_solutions"), // 'No Storage', '3 Drawers', etc.
  colors: text("colors").array(),
  materials: text("materials").array(),
  
  // Physical specifications
  dimensions: jsonb("dimensions"), // { w, d, h, armWidth, armDepth, seatWidth, seatDepth, unit }
  weight: text("weight"), // '150 lbs'
  seating: text("seating"), // '2 seats', '3-4 people', etc.
  assembly: text("assembly"), // 'Yes', 'No', 'Partial'
  
  // Inventory & shipping
  inventory: integer("inventory"),
  leadTime: integer("lead_time"), // days
  availability: varchar("availability", { length: 20 }).notNull().default("in_stock"), // 'in_stock' or 'preorder'
  shipping: jsonb("shipping"), // { cost, eta, deliveryOptions, deliveryLocation, deliveryPolicy }
  
  // Media & metadata
  images: text("images").array(), // URLs to images
  asset3dUrl: text("asset_3d_url"), // .glb or .usdz for AR
  visualDescription: text("visual_description"), // Active visual description from Gemini
  visualDescriptionGemini: text("visual_description_gemini"), // Gemini Vision analysis
  // Front-view specific descriptions (for prioritized analysis)
  visualDescriptionFrontView: text("visual_description_front_view"), // Active front-view description
  visualDescriptionFrontViewGemini: text("visual_description_front_view_gemini"), // Gemini front-view analysis
  // Multi-angle analysis fields
  imageAnalyses: jsonb("image_analyses"), // { [imageUrl]: { angle, confidence, description, features } }
  synthesizedFrontView: text("synthesized_front_view"), // AI-generated front view from multi-angle synthesis
  completeProductDescription: text("complete_product_description"), // Comprehensive description from all angles
  tags: text("tags").array(), // General tags for search/categorization
  sourceFile: text("source_file"), // Original import file reference
  seoMeta: jsonb("seo_meta"), // { title, description }
  slug: varchar("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Quiz Responses - User design preferences
export const quizResponses = pgTable("quiz_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  roomType: text("room_type").notNull(), // 'Living Room', 'Bedroom', etc.
  style: text("style").notNull(), // 'Midcentury Scandi', etc.
  colorPalettes: text("color_palettes").array(), // ['Light Neutrals', 'Warm & Cozy']
  keyFeatures: text("key_features").array(), // ['Comfortable Seat', 'Storage']
  budgetRange: text("budget_range").notNull(), // '$2K-$5K', etc.
  vibeImages: text("vibe_images").array(), // User-uploaded reference images
  preferences: text("preferences").array(), // Design preference bullets
  floorplanUrl: text("floorplan_url"), // Uploaded floorplan image
  // Rich visual preferences from vibe image analysis
  vibeColorPalette: text("vibe_color_palette").array(), // AI-extracted color palette from vibe images
  vibeMaterials: text("vibe_materials").array(), // AI-extracted materials from vibe images
  vibeTextures: text("vibe_textures").array(), // AI-extracted textures from vibe images
  vibeLightingTone: text("vibe_lighting_tone"), // 'warm', 'cool', 'natural', 'dramatic'
  vibeDensity: text("vibe_density"), // 'minimal', 'moderate', 'layered'
  vibeOverallDescription: text("vibe_overall_description"), // Overall vibe/aesthetic description
  createdAt: timestamp("created_at").defaultNow(),
});

export type QuizResponse = typeof quizResponses.$inferSelect;
export const insertQuizResponseSchema = createInsertSchema(quizResponses).omit({
  id: true,
  createdAt: true,
});
export type InsertQuizResponse = z.infer<typeof insertQuizResponseSchema>;

// Renders - AI-generated room designs
export const renders = pgTable("renders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizResponseId: varchar("quiz_response_id").notNull().references(() => quizResponses.id),
  sessionId: varchar("session_id").notNull(),
  imageUrl: text("image_url"), // Public URL to generated render
  prompt: text("prompt").notNull(), // Full AI prompt used
  productSkus: text("product_skus").array(), // Products featured in render
  productPlacements: jsonb("product_placements"), // Spatial metadata: [{ sku, region, boundingBox }]
  productMetadata: jsonb("product_metadata"), // Product-specific metadata: { [sku]: { visualDescriptionSource: 'Front View' | 'Gemini Vision' | 'OpenAI Vision' | 'Legacy' | 'None' } }
  parentRenderId: varchar("parent_render_id"), // References parent render if this is a swap
  swappedSku: text("swapped_sku"), // SKU that was replaced (if this is a swap)
  status: varchar("status", { length: 20 }).notNull().default("generating"), // 'generating', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const renderRelations = relations(renders, ({ one }) => ({
  quizResponse: one(quizResponses, {
    fields: [renders.quizResponseId],
    references: [quizResponses.id],
  }),
}));

export type Render = typeof renders.$inferSelect;

// Type for productMetadata JSONB field structure
export type ProductMetadata = Record<string, { 
  visualDescriptionSource: 'Front View' | 'Gemini Vision' | 'OpenAI Vision' | 'Legacy' | 'None' 
}>;

export const insertRenderSchema = createInsertSchema(renders).omit({
  id: true,
  createdAt: true,
});
export type InsertRender = z.infer<typeof insertRenderSchema>;

// Selection Ledger - Complete audit trail of product selection decisions
export const selectionLedger = pgTable("selection_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  renderId: varchar("render_id").notNull().references(() => renders.id).unique(),
  selectionHash: varchar("selection_hash", { length: 64 }).notNull().unique(), // SHA-256 hash for idempotency
  candidatePoolSnapshot: jsonb("candidate_pool_snapshot").notNull(), // All products available before filtering: [{ sku, name, category, ... }]
  selectionRationale: jsonb("selection_rationale").notNull(), // Decision trail: { essentials: {...}, complementary: {...}, excluded: [...] }
  compositionOrder: text("composition_order").array().notNull(), // Ordered list of SKUs in composition priority
  lockedAt: timestamp("locked_at"), // When selection was finalized (null = still selecting)
  createdAt: timestamp("created_at").defaultNow(),
});

export const selectionLedgerRelations = relations(selectionLedger, ({ one }) => ({
  render: one(renders, {
    fields: [selectionLedger.renderId],
    references: [renders.id],
  }),
}));

export type SelectionLedger = typeof selectionLedger.$inferSelect;

// Type for candidate pool snapshot structure
export type CandidatePoolSnapshot = Array<{
  sku: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  hasValidImage: boolean;
  hasVisualDescription: boolean;
}>;

// Type for selection rationale structure
export type SelectionRationale = {
  essentials: Record<string, {
    category: string; // e.g., 'primary_seating'
    selectedProducts: Array<{ sku: string; name: string; reason: string }>;
    rulesApplied: { min: number; max: number; priority: number };
  }>;
  complementary: Record<string, {
    category: string;
    selectedProducts: Array<{ sku: string; name: string; reason: string }>;
    rulesApplied: { min: number; max: number; priority: number };
  }>;
  excluded: Array<{
    sku: string;
    name: string;
    reason: string; // Why this product wasn't selected
  }>;
  diversityScore: number; // How well products are distributed across categories
};

export const insertSelectionLedgerSchema = createInsertSchema(selectionLedger).omit({
  id: true,
  createdAt: true,
});
export type InsertSelectionLedger = z.infer<typeof insertSelectionLedgerSchema>;

// Cart Items - Shopping cart
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItemRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export type CartItem = typeof cartItems.$inferSelect;
export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

// Orders - Purchase orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'paid', 'fulfilled', 'shipped', 'delivered'
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  customerEmail: varchar("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  shippingAddress: jsonb("shipping_address").notNull(), // { street, city, state, zip, country }
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Order = typeof orders.$inferSelect;
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;

// Order Items - Individual items in orders
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtPurchase: decimal("price_at_purchase", { precision: 10, scale: 2 }).notNull(), // Price snapshot
});

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

// ===== AI TRAINING DATA SCHEMA =====

// Design Examples - Reference designs for AI learning (good/bad examples)
export const designExamples = pgTable("design_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 20 }).notNull(), // 'good' or 'bad'
  roomType: text("room_type").notNull(), // 'Living Room', 'Bedroom', etc.
  styles: text("styles").array(), // ['Modern', 'Contemporary']
  imageUrl: text("image_url").notNull(), // URL to reference image
  title: text("title").notNull(), // Short descriptive title
  description: text("description"), // What makes this good/bad
  reasoning: text("reasoning").notNull(), // Why this is a good/bad example
  designPrinciples: text("design_principles").array(), // ['Balance', 'Proportion', 'Color Harmony']
  tags: text("tags").array(), // Searchable tags
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const designExampleRelations = relations(designExamples, ({ one }) => ({
  creator: one(users, {
    fields: [designExamples.createdBy],
    references: [users.id],
  }),
}));

export type DesignExample = typeof designExamples.$inferSelect;
export const insertDesignExampleSchema = createInsertSchema(designExamples).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDesignExample = z.infer<typeof insertDesignExampleSchema>;

// Product Packages - Pre-curated product combinations that work well together
export const productPackages = pgTable("product_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'Modern Living Room Essentials'
  description: text("description"), // What makes this package special
  roomType: text("room_type").notNull(), // 'Living Room'
  styles: text("styles").array(), // ['Modern', 'Midcentury']
  productSkus: text("product_skus").array().notNull(), // SKUs that work together
  imageUrl: text("image_url"), // Package visualization
  priceRange: text("price_range"), // '$3,000-$5,000'
  designNotes: text("design_notes"), // Why these products work together
  tags: text("tags").array(),
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productPackageRelations = relations(productPackages, ({ one }) => ({
  creator: one(users, {
    fields: [productPackages.createdBy],
    references: [users.id],
  }),
}));

export type ProductPackage = typeof productPackages.$inferSelect;
export const insertProductPackageSchema = createInsertSchema(productPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductPackage = z.infer<typeof insertProductPackageSchema>;

// Placement Guidelines - Rules for where products should be placed in rooms
export const placementGuidelines = pgTable("placement_guidelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCategory: text("product_category").notNull(), // 'Sofa', 'Coffee Table', 'Dining Table'
  roomType: text("room_type").notNull(), // 'Living Room', 'Dining Room'
  guideline: text("guideline").notNull(), // 'Place sofa 12-18 inches from wall'
  doExamples: text("do_examples").array(), // List of good placement practices
  dontExamples: text("dont_examples").array(), // List of bad placement practices
  imageUrl: text("image_url"), // Visual reference
  priority: integer("priority").notNull().default(1), // Higher priority = more important rule
  reasoning: text("reasoning"), // Why this guideline matters
  tags: text("tags").array(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const placementGuidelineRelations = relations(placementGuidelines, ({ one }) => ({
  creator: one(users, {
    fields: [placementGuidelines.createdBy],
    references: [users.id],
  }),
}));

export type PlacementGuideline = typeof placementGuidelines.$inferSelect;
export const insertPlacementGuidelineSchema = createInsertSchema(placementGuidelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlacementGuideline = z.infer<typeof insertPlacementGuidelineSchema>;

// Design Rules - General design principles and rules for AI to follow
export const designRules = pgTable("design_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'color', 'spacing', 'proportion', 'balance', 'contrast'
  rule: text("rule").notNull(), // The actual design rule
  description: text("description"), // Detailed explanation
  examples: text("examples").array(), // Examples of the rule in practice
  counterExamples: text("counter_examples").array(), // What NOT to do
  priority: integer("priority").notNull().default(1), // Higher = more important
  applicableRooms: text("applicable_rooms").array(), // Which rooms this applies to
  applicableStyles: text("applicable_styles").array(), // Which styles this applies to
  active: boolean("active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const designRuleRelations = relations(designRules, ({ one }) => ({
  creator: one(users, {
    fields: [designRules.createdBy],
    references: [users.id],
  }),
}));

export type DesignRule = typeof designRules.$inferSelect;
export const insertDesignRuleSchema = createInsertSchema(designRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDesignRule = z.infer<typeof insertDesignRuleSchema>;

// Upload Jobs - Track background upload jobs for products
export const uploadJobs = pgTable("upload_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  productId: varchar("product_id").references(() => products.id).notNull(),
  status: varchar("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'paused'
  totalFiles: integer("total_files").notNull().default(0),
  completedFiles: integer("completed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  skippedFiles: integer("skipped_files").notNull().default(0), // Duplicates
  currentFileName: text("current_file_name"), // Currently processing file
  errorMessage: text("error_message"), // Error details if failed
  metadata: jsonb("metadata"), // Additional job info (folder path, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_job_product_status").on(table.productId, table.status),
  index("idx_job_status").on(table.status),
]);

export const uploadJobRelations = relations(uploadJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [uploadJobs.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [uploadJobs.productId],
    references: [products.id],
  }),
  files: many(uploadJobFiles),
}));

export type UploadJob = typeof uploadJobs.$inferSelect;
export const insertUploadJobSchema = createInsertSchema(uploadJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUploadJob = z.infer<typeof insertUploadJobSchema>;

// Upload Job Files - Track individual files within an upload job
export const uploadJobFiles = pgTable("upload_job_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => uploadJobs.id).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // Size in bytes
  fileHash: text("file_hash"), // SHA-256 hash for durable duplicate detection
  status: varchar("status").notNull().default("pending"), // 'pending', 'uploading', 'completed', 'failed', 'skipped'
  s3Url: text("s3_url"), // URL after successful upload
  errorMessage: text("error_message"),
  isDuplicate: boolean("is_duplicate").notNull().default(false),
  uploadedAt: timestamp("uploaded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_file_job_status").on(table.jobId, table.status),
]);

export const uploadJobFileRelations = relations(uploadJobFiles, ({ one }) => ({
  job: one(uploadJobs, {
    fields: [uploadJobFiles.jobId],
    references: [uploadJobs.id],
  }),
}));

export type UploadJobFile = typeof uploadJobFiles.$inferSelect;
export const insertUploadJobFileSchema = createInsertSchema(uploadJobFiles).omit({
  id: true,
  createdAt: true,
});
export type InsertUploadJobFile = z.infer<typeof insertUploadJobFileSchema>;

// Visual Analysis Jobs - Track AI-powered visual description generation
export const visualAnalysisJobs = pgTable("visual_analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  status: varchar("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'paused'
  jobType: varchar("job_type").notNull().default("manual"), // 'manual', 'auto_after_upload'
  uploadJobId: varchar("upload_job_id").references(() => uploadJobs.id), // Link to upload job if auto-triggered
  totalProducts: integer("total_products").notNull().default(0),
  analyzedProducts: integer("analyzed_products").notNull().default(0),
  failedProducts: integer("failed_products").notNull().default(0),
  skippedProducts: integer("skipped_products").notNull().default(0), // Already have visual descriptions
  currentProductName: text("current_product_name"), // Currently analyzing product
  errorMessage: text("error_message"), // Error details if failed
  metadata: jsonb("metadata"), // Additional job info (batch size, filters, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_analysis_job_status").on(table.status),
  index("idx_analysis_job_upload").on(table.uploadJobId),
]);

export const visualAnalysisJobRelations = relations(visualAnalysisJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [visualAnalysisJobs.userId],
    references: [users.id],
  }),
  uploadJob: one(uploadJobs, {
    fields: [visualAnalysisJobs.uploadJobId],
    references: [uploadJobs.id],
  }),
  products: many(visualAnalysisProducts),
}));

export type VisualAnalysisJob = typeof visualAnalysisJobs.$inferSelect;
export const insertVisualAnalysisJobSchema = createInsertSchema(visualAnalysisJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVisualAnalysisJob = z.infer<typeof insertVisualAnalysisJobSchema>;

// Visual Analysis Products - Track individual products within an analysis job
export const visualAnalysisProducts = pgTable("visual_analysis_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => visualAnalysisJobs.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  productSku: varchar("product_sku").notNull(),
  productName: text("product_name").notNull(),
  status: varchar("status").notNull().default("pending"), // 'pending', 'analyzing', 'completed', 'failed', 'skipped'
  geminiStatus: varchar("gemini_status"), // 'success', 'failed', null
  openaiStatus: varchar("openai_status"), // 'success', 'failed', null
  geminiDescription: text("gemini_description"), // Gemini result
  openaiDescription: text("openai_description"), // OpenAI result
  errorMessage: text("error_message"),
  analyzedAt: timestamp("analyzed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analysis_product_job_status").on(table.jobId, table.status),
  index("idx_analysis_product_id").on(table.productId),
  unique("job_product_unique").on(table.jobId, table.productId),
]);

export const visualAnalysisProductRelations = relations(visualAnalysisProducts, ({ one }) => ({
  job: one(visualAnalysisJobs, {
    fields: [visualAnalysisProducts.jobId],
    references: [visualAnalysisJobs.id],
  }),
  product: one(products, {
    fields: [visualAnalysisProducts.productId],
    references: [products.id],
  }),
}));

export type VisualAnalysisProduct = typeof visualAnalysisProducts.$inferSelect;
export const insertVisualAnalysisProductSchema = createInsertSchema(visualAnalysisProducts).omit({
  id: true,
  createdAt: true,
});
export type InsertVisualAnalysisProduct = z.infer<typeof insertVisualAnalysisProductSchema>;

// Room Templates - Define standard composition for each room type
export const roomTemplates = pgTable("room_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomType: text("room_type").notNull().unique(), // 'Living Room', 'Bedroom', 'Dining Room', 'Office'
  name: text("name").notNull(), // Human-readable name
  description: text("description"), // Template description
  minRoomSize: integer("min_room_size"), // Minimum square footage
  maxRoomSize: integer("max_room_size"), // Maximum square footage
  metadata: jsonb("metadata"), // Additional configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type RoomTemplate = typeof roomTemplates.$inferSelect;
export const insertRoomTemplateSchema = createInsertSchema(roomTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRoomTemplate = z.infer<typeof insertRoomTemplateSchema>;

// Functional Categories - Define product roles in a room
export const functionalCategories = pgTable("functional_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 'primary_seating', 'accent_seating', 'coffee_table', 'side_table', 'storage', 'lighting', 'decor'
  displayName: text("display_name").notNull(), // Human-readable name
  description: text("description"),
  spatialRequirements: jsonb("spatial_requirements"), // { minFloorSpace: 20, verticalSpace: 'floor' | 'wall' | 'ceiling' }
  visualWeight: text("visual_weight"), // 'dominant', 'supporting', 'accent'
  createdAt: timestamp("created_at").defaultNow(),
});

export type FunctionalCategory = typeof functionalCategories.$inferSelect;
export const insertFunctionalCategorySchema = createInsertSchema(functionalCategories).omit({
  id: true,
  createdAt: true,
});
export type InsertFunctionalCategory = z.infer<typeof insertFunctionalCategorySchema>;

// Template Category Rules - Define composition rules for each template
export const templateCategoryRules = pgTable("template_category_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => roomTemplates.id),
  functionalCategoryId: varchar("functional_category_id").notNull().references(() => functionalCategories.id),
  minCount: integer("min_count").notNull().default(0), // Minimum required items
  maxCount: integer("max_count").notNull().default(1), // Maximum allowed items
  priority: integer("priority").notNull().default(100), // Selection priority (lower = higher priority)
  isEssential: boolean("is_essential").notNull().default(false), // Must be included
  placementZone: text("placement_zone"), // 'center', 'perimeter', 'corner', 'focal'
  adjacencyRules: jsonb("adjacency_rules"), // Rules for what can be placed nearby
  createdAt: timestamp("created_at").defaultNow(),
});

export type TemplateCategoryRule = typeof templateCategoryRules.$inferSelect;
export const insertTemplateCategoryRuleSchema = createInsertSchema(templateCategoryRules).omit({
  id: true,
  createdAt: true,
});
export type InsertTemplateCategoryRule = z.infer<typeof insertTemplateCategoryRuleSchema>;

// Product Functional Categories - Map products to functional categories
export const productFunctionalCategories = pgTable("product_functional_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  functionalCategoryId: varchar("functional_category_id").notNull().references(() => functionalCategories.id),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull().default("1.00"), // 0.00-1.00 confidence score
  source: text("source").notNull().default("manual"), // 'manual', 'ai_analysis', 'rule_based'
  metadata: jsonb("metadata"), // Additional classification data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("product_functional_unique").on(table.productId, table.functionalCategoryId),
]);
