/**
 * Make recommended products cartable (ADR-0025).
 *
 * `cart_items.product_id` references the app's own `products` table, but the
 * consultation recommender scores the supplier handoff workbooks, which the
 * app has never imported. Each placed product is therefore upserted into
 * `products` keyed by `sku = <recommendation product_id>` (e.g.
 * `Luxus:row622`, `Celadon:21368`), which is stable for a given workbook
 * version. Supplier and category rows are found by name or created.
 *
 * Nothing is invented: a supplier row gets an empty email (the workbooks
 * carry none), and the product carries only fields the recommender returned.
 * Price is the recommender's unit price in whole currency units.
 */

import type {
  Category,
  InsertCategory,
  InsertProduct,
  InsertSupplier,
  Product,
  Supplier,
} from "@shared/schema";
import type { ConsultationProduct } from "./recommendation-client.js";

export interface ProductSyncStorage {
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(input: InsertProduct): Promise<Product>;
  updateProduct(id: string, input: Partial<InsertProduct>): Promise<Product>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  createSupplier(input: InsertSupplier): Promise<Supplier>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(input: InsertCategory): Promise<Category>;
}

export const RECOMMENDATION_SOURCE_TAG = "curalina-recommendation";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function priceString(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Upserts each product (in order, de-duplicated) and returns the app rows
 * keyed by recommendation `product_id`. Products without a price are skipped:
 * the recommender never places one, and a cart line needs a price.
 */
export async function syncRecommendedProducts(
  storage: ProductSyncStorage,
  items: ConsultationProduct[],
  sourceFile: string
): Promise<Map<string, Product>> {
  const synced = new Map<string, Product>();
  const suppliers = new Map<string, Supplier>();
  const categories = new Map<string, Category>();

  for (const item of items) {
    if (synced.has(item.product_id) || item.unit_price_minor_units === null) continue;

    let supplier = suppliers.get(item.supplier) ?? (await storage.getSupplierByName(item.supplier));
    if (!supplier) supplier = await storage.createSupplier({ name: item.supplier, email: "" });
    suppliers.set(item.supplier, supplier);

    let category = categories.get(item.category) ?? (await storage.getCategoryByName(item.category));
    if (!category) {
      category = await storage.createCategory({
        name: item.category,
        type: "furniture",
        slug: `rec-${slugify(item.category)}`,
      });
    }
    categories.set(item.category, category);

    const fields: Partial<InsertProduct> = {
      name: item.name,
      price: priceString(item.unit_price_minor_units),
      roomType: item.rooms,
      designStyle: item.styles,
      styleTags: item.atmospheres,
      supplierId: supplier.id,
      categoryId: category.id,
      sourceFile,
    };
    const existing = await storage.getProductBySku(item.product_id);
    const product = existing
      ? await storage.updateProduct(existing.id, fields)
      : await storage.createProduct({
          ...fields,
          sku: item.product_id,
          slug: `${slugify(item.supplier)}-${slugify(item.name)}-${slugify(item.product_id)}`,
          tags: [RECOMMENDATION_SOURCE_TAG],
          images: [],
        } as InsertProduct);
    synced.set(item.product_id, product);
  }
  return synced;
}
