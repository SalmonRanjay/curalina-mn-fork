import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  decimal,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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
  categoryId: varchar("category_id").references(() => categories.id),
  styleTags: text("style_tags").array(), // ['modern', 'organic']
  colors: text("colors").array(),
  materials: text("materials").array(),
  dimensions: jsonb("dimensions"), // { w, d, h, unit }
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  availability: varchar("availability", { length: 20 }).notNull().default("in_stock"), // 'in_stock' or 'preorder'
  images: text("images").array(), // URLs to images
  asset3dUrl: text("asset_3d_url"), // .glb or .usdz for AR
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  shipping: jsonb("shipping"), // { cost, eta }
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
  quizResponseId: varchar("quiz_response_id").references(() => quizResponses.id),
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
  productId: varchar("product_id").references(() => products.id),
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
  orderId: varchar("order_id").references(() => orders.id),
  productId: varchar("product_id").references(() => products.id),
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
