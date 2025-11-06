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
  keyFeatures: text("key_features").array(), // ['Comfortable Seat', 'Storage']
  budgetRange: text("budget_range").notNull(), // '$2K-$5K', etc.
  vibeImages: text("vibe_images").array(), // User-uploaded reference images
  preferences: text("preferences").array(), // Design preference bullets
  floorplanUrl: text("floorplan_url"), // Uploaded floorplan image
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
