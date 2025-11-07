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
  dimensions: jsonb("dimensions"), // { w, d, h, unit }
  weight: text("weight"), // '150 lbs'
  assembly: text("assembly"), // 'Yes', 'No', 'Partial'
  
  // Inventory & shipping
  inventory: integer("inventory"),
  leadTime: integer("lead_time"), // days
  availability: varchar("availability", { length: 20 }).notNull().default("in_stock"), // 'in_stock' or 'preorder'
  shipping: jsonb("shipping"), // { cost, eta }
  
  // Media & metadata
  images: text("images").array(), // URLs to images
  asset3dUrl: text("asset_3d_url"), // .glb or .usdz for AR
  visualDescription: text("visual_description"), // Gemini Vision analysis of product images
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
export const insertRenderSchema = createInsertSchema(renders).omit({
  id: true,
  createdAt: true,
});
export type InsertRender = z.infer<typeof insertRenderSchema>;

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
