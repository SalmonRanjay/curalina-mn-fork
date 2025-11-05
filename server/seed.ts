import { db } from "./db";
import { categories, vendors, products } from "@shared/schema";

async function seed() {
  console.log("Starting database seed...");

  // Seed Categories
  console.log("Seeding categories...");
  const roomCategories = [
    { name: "Living Room", type: "room" as const, slug: "living-room" },
    { name: "Bedroom", type: "room" as const, slug: "bedroom" },
    { name: "Dining Room", type: "room" as const, slug: "dining-room" },
    { name: "Office", type: "room" as const, slug: "office" },
    { name: "Kitchen", type: "room" as const, slug: "kitchen" },
  ];

  const furnitureCategories = [
    { name: "Sofa", type: "furniture" as const, slug: "sofa" },
    { name: "Chair", type: "furniture" as const, slug: "chair" },
    { name: "Table", type: "furniture" as const, slug: "table" },
    { name: "Bed", type: "furniture" as const, slug: "bed" },
    { name: "Storage", type: "furniture" as const, slug: "storage" },
    { name: "Lighting", type: "furniture" as const, slug: "lighting" },
    { name: "Decor", type: "furniture" as const, slug: "decor" },
  ];

  const allCategories = [...roomCategories, ...furnitureCategories];
  
  for (const cat of allCategories) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }

  // Seed Vendors
  console.log("Seeding vendors...");
  const vendorList = [
    { name: "Modern Furniture Co", email: "contact@modernfurniture.com" },
    { name: "Scandinavian Designs", email: "info@scandidesigns.com" },
    { name: "Organic Home", email: "hello@organichome.com" },
    { name: "Industrial Loft", email: "sales@industrialloft.com" },
  ];

  const insertedVendors = [];
  for (const vendor of vendorList) {
    const [inserted] = await db.insert(vendors).values(vendor).returning().onConflictDoNothing();
    if (inserted) insertedVendors.push(inserted);
  }

  // Get inserted categories for product references
  const sofaCategory = await db.query.categories.findFirst({ where: (c, { eq }) => eq(c.slug, "sofa") });
  const chairCategory = await db.query.categories.findFirst({ where: (c, { eq }) => eq(c.slug, "chair") });
  const tableCategory = await db.query.categories.findFirst({ where: (c, { eq }) => eq(c.slug, "table") });
  const lightingCategory = await db.query.categories.findFirst({ where: (c, { eq }) => eq(c.slug, "lighting") });

  if (!sofaCategory || !chairCategory || !tableCategory || !lightingCategory || insertedVendors.length === 0) {
    console.error("Failed to fetch required categories or vendors");
    return;
  }

  // Seed Products
  console.log("Seeding products...");
  const productList = [
    // Sofas
    {
      sku: "SOFA-MCM-001",
      name: "Midcentury Modern Sofa",
      description: "A beautifully crafted midcentury modern sofa with clean lines and organic shapes. Features teak wood legs and comfortable cushioning.",
      categoryId: sofaCategory.id,
      vendorId: insertedVendors[0].id,
      styleTags: ["midcentury", "modern", "organic"],
      colors: ["beige", "gray", "navy"],
      materials: ["teak", "fabric", "foam"],
      dimensions: { w: 84, d: 36, h: 32, unit: "inches" },
      price: "1499.00",
      discount: "0",
      availability: "in_stock" as const,
      images: ["/images/sofa-mcm-001.jpg"],
      slug: "midcentury-modern-sofa",
      shipping: { cost: 99, eta: "7-10 business days" },
      seoMeta: { title: "Midcentury Modern Sofa", description: "Premium midcentury sofa with teak legs" },
    },
    {
      sku: "SOFA-ORG-002",
      name: "Organic Curved Sofa",
      description: "A luxurious curved sofa featuring organic shapes and natural materials. Perfect for modern living spaces.",
      categoryId: sofaCategory.id,
      vendorId: insertedVendors[2].id,
      styleTags: ["organic", "modern", "minimalist"],
      colors: ["cream", "terracotta", "olive"],
      materials: ["linen", "oak", "foam"],
      dimensions: { w: 90, d: 38, h: 30, unit: "inches" },
      price: "1899.00",
      discount: "10",
      availability: "in_stock" as const,
      images: ["/images/sofa-org-002.jpg"],
      slug: "organic-curved-sofa",
      shipping: { cost: 120, eta: "10-14 business days" },
      seoMeta: { title: "Organic Curved Sofa", description: "Curved sofa with natural materials" },
    },
    // Chairs
    {
      sku: "CHAIR-SCANDI-001",
      name: "Scandinavian Dining Chair",
      description: "Classic Scandinavian design with clean lines and comfortable ergonomics. Perfect for dining spaces.",
      categoryId: chairCategory.id,
      vendorId: insertedVendors[1].id,
      styleTags: ["scandinavian", "midcentury", "minimalist"],
      colors: ["oak", "walnut", "white"],
      materials: ["oak", "fabric"],
      dimensions: { w: 18, d: 20, h: 32, unit: "inches" },
      price: "299.00",
      discount: "0",
      availability: "in_stock" as const,
      images: ["/images/chair-scandi-001.jpg"],
      slug: "scandinavian-dining-chair",
      shipping: { cost: 25, eta: "5-7 business days" },
      seoMeta: { title: "Scandinavian Dining Chair", description: "Classic Scandi dining chair" },
    },
    {
      sku: "CHAIR-MCM-002",
      name: "Midcentury Lounge Chair",
      description: "Iconic midcentury lounge chair with teak frame and plush cushioning. A timeless piece.",
      categoryId: chairCategory.id,
      vendorId: insertedVendors[0].id,
      styleTags: ["midcentury", "modern", "organic"],
      colors: ["cognac", "black", "olive"],
      materials: ["teak", "leather", "foam"],
      dimensions: { w: 30, d: 32, h: 34, unit: "inches" },
      price: "799.00",
      discount: "15",
      availability: "in_stock" as const,
      images: ["/images/chair-mcm-002.jpg"],
      slug: "midcentury-lounge-chair",
      shipping: { cost: 45, eta: "7-10 business days" },
      seoMeta: { title: "Midcentury Lounge Chair", description: "Teak frame lounge chair" },
    },
    // Tables
    {
      sku: "TABLE-IND-001",
      name: "Industrial Coffee Table",
      description: "Sturdy industrial coffee table with metal frame and reclaimed wood top. Perfect for modern lofts.",
      categoryId: tableCategory.id,
      vendorId: insertedVendors[3].id,
      styleTags: ["industrial", "modern", "minimalist"],
      colors: ["wood", "black", "gray"],
      materials: ["steel", "reclaimed wood"],
      dimensions: { w: 48, d: 24, h: 18, unit: "inches" },
      price: "549.00",
      discount: "0",
      availability: "in_stock" as const,
      images: ["/images/table-ind-001.jpg"],
      slug: "industrial-coffee-table",
      shipping: { cost: 75, eta: "7-10 business days" },
      seoMeta: { title: "Industrial Coffee Table", description: "Metal and wood coffee table" },
    },
    {
      sku: "TABLE-ORG-002",
      name: "Organic Round Dining Table",
      description: "Beautiful round dining table crafted from sustainable oak. Features a natural edge for organic appeal.",
      categoryId: tableCategory.id,
      vendorId: insertedVendors[2].id,
      styleTags: ["organic", "modern", "scandinavian"],
      colors: ["oak", "walnut"],
      materials: ["oak", "steel"],
      dimensions: { w: 54, d: 54, h: 30, unit: "inches" },
      price: "1299.00",
      discount: "5",
      availability: "in_stock" as const,
      images: ["/images/table-org-002.jpg"],
      slug: "organic-round-dining-table",
      shipping: { cost: 95, eta: "10-14 business days" },
      seoMeta: { title: "Organic Round Dining Table", description: "Sustainable oak dining table" },
    },
    // Lighting
    {
      sku: "LIGHT-MCM-001",
      name: "Midcentury Pendant Light",
      description: "Elegant pendant light with brass finish and opal glass shade. Brings warm illumination to any space.",
      categoryId: lightingCategory.id,
      vendorId: insertedVendors[0].id,
      styleTags: ["midcentury", "modern", "minimalist"],
      colors: ["brass", "gold", "black"],
      materials: ["brass", "glass"],
      dimensions: { w: 12, d: 12, h: 16, unit: "inches" },
      price: "349.00",
      discount: "0",
      availability: "in_stock" as const,
      images: ["/images/light-mcm-001.jpg"],
      slug: "midcentury-pendant-light",
      shipping: { cost: 35, eta: "5-7 business days" },
      seoMeta: { title: "Midcentury Pendant Light", description: "Brass pendant with glass shade" },
    },
    {
      sku: "LIGHT-ORG-002",
      name: "Organic Woven Table Lamp",
      description: "Handwoven rattan lamp with natural finish. Creates warm, ambient lighting with organic texture.",
      categoryId: lightingCategory.id,
      vendorId: insertedVendors[2].id,
      styleTags: ["organic", "bohemian", "coastal"],
      colors: ["natural", "white"],
      materials: ["rattan", "fabric"],
      dimensions: { w: 14, d: 14, h: 22, unit: "inches" },
      price: "189.00",
      discount: "10",
      availability: "in_stock" as const,
      images: ["/images/light-org-002.jpg"],
      slug: "organic-woven-table-lamp",
      shipping: { cost: 25, eta: "5-7 business days" },
      seoMeta: { title: "Organic Woven Table Lamp", description: "Rattan table lamp" },
    },
  ];

  for (const product of productList) {
    await db.insert(products).values(product).onConflictDoNothing();
  }

  console.log("Seed completed successfully!");
}

seed()
  .then(() => {
    console.log("Database seeded");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
