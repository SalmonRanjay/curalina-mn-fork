import type { Express } from "express";
import multer from "multer";
import { curalinaStorage } from "./storage-curalina";
import { ObjectStorageService } from "./objectStorage";
import { ImageHealthWorker } from "./services/image-health-worker";
import { db, pool } from "./db";
import { sql, and } from "drizzle-orm";
import {
  insertQuizResponseSchema,
  insertRenderSchema,
  insertCartItemSchema,
  insertOrderSchema,
  insertCategorySchema,
  insertSupplierSchema,
  insertProductSchema,
  insertDesignExampleSchema,
  insertProductPackageSchema,
  insertPlacementGuidelineSchema,
  insertDesignRuleSchema,
  insertRenderProductSchema,
  insertRenderEventSchema,
  insertDocumentationSectionSchema,
  insertDocumentationCommentSchema,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated } from "./localAuth";
import { isAdmin } from "./routes";
import { buildPromptFromQuiz, generateInteriorImage, extractProductSkus } from "./services/gemini-ai";
import { uploadToS3, generateProductImageKey, generatePresignedUploadUrl, checkS3ObjectExists } from "./s3";
import type { PlacementInstruction } from "./services/room-composition-service";

const upload = multer({ storage: multer.memoryStorage() });
const objectStorageService = new ObjectStorageService();

// Export image health worker for use in scheduled jobs
export const imageHealthWorker = new ImageHealthWorker(curalinaStorage);

// Helper to parse object storage paths
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}

export function registerCuralinaRoutes(app: Express) {
  // Admin endpoints for categories, suppliers, products (protected)
  
  // Categories
  app.get('/api/admin/categories', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const categories = await curalinaStorage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post('/api/admin/categories', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await curalinaStorage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.delete('/api/admin/categories/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Suppliers
  app.get('/api/admin/suppliers', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const suppliers = await curalinaStorage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post('/api/admin/suppliers', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertSupplierSchema.parse(req.body);
      const supplier = await curalinaStorage.createSupplier(validatedData);
      res.json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid supplier data", details: error.errors });
      }
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.delete('/api/admin/suppliers/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteSupplier(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // Products
  app.get('/api/admin/products', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const products = await curalinaStorage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post('/api/admin/products', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await curalinaStorage.createProduct(validatedData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put('/api/admin/products/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await curalinaStorage.updateProduct(req.params.id, validatedData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.patch('/api/admin/products/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await curalinaStorage.updateProduct(req.params.id, validatedData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete('/api/admin/products/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Image health management routes
  app.patch('/api/admin/products/:id/image-health/repair', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const product = await curalinaStorage.setProductImageHealthStatus(
        req.params.id,
        'repairing',
        {
          repairedAt: new Date(),
          repairedBy: req.user?.id,
          action: 'manual_repair'
        }
      );
      res.json(product);
    } catch (error) {
      console.error("Error repairing product images:", error);
      res.status(500).json({ error: "Failed to repair product images" });
    }
  });

  app.patch('/api/admin/products/:id/image-health/remove', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const product = await curalinaStorage.setProductImageHealthStatus(
        req.params.id,
        'removed',
        {
          removedAt: new Date(),
          removedBy: req.user?.id,
          reason: req.body.reason || 'manual_removal',
          action: 'manual_remove'
        }
      );
      res.json(product);
    } catch (error) {
      console.error("Error removing product images:", error);
      res.status(500).json({ error: "Failed to remove product images" });
    }
  });

  // Image health validation worker routes
  app.post('/api/admin/image-health/validate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const result = await imageHealthWorker.runValidation();
      res.json(result);
    } catch (error: any) {
      console.error("Error running image validation:", error);
      res.status(500).json({ error: error.message || "Failed to run validation" });
    }
  });

  app.get('/api/admin/image-health/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = imageHealthWorker.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting worker status:", error);
      res.status(500).json({ error: "Failed to get worker status" });
    }
  });

  // Generate presigned URL for direct browser-to-S3 upload (FAST - no server relay)
  app.post('/api/admin/products/:id/presigned-upload-url', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { filename, contentType } = req.body;
      
      if (!filename || !contentType) {
        return res.status(400).json({ error: "filename and contentType are required" });
      }

      const productId = req.params.id;
      
      // Get product to retrieve SKU
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Generate S3 key for this upload
      const s3Key = generateProductImageKey(product.sku, filename);
      
      // Check if this exact file already exists in S3
      const existsInS3 = await checkS3ObjectExists(s3Key);
      
      if (existsInS3) {
        return res.json({
          duplicate: true,
          filename,
          message: `Image "${filename}" already exists for this product`
        });
      }

      // Generate presigned POST URL
      const presignedData = await generatePresignedUploadUrl(s3Key, contentType);
      
      // Use the same sanitized AWS_REGION as in s3.ts
      const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
      
      res.json({
        duplicate: false,
        ...presignedData,
        publicUrl: `https://curalina.s3.${AWS_REGION}.amazonaws.com/${s3Key}`
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      
      if (error instanceof Error) {
        if (error.message.includes('File type')) {
          return res.status(400).json({ error: error.message });
        }
      }
      
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Confirm product image upload (after direct S3 upload)
  app.post('/api/admin/products/:id/confirm-upload', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      const productId = req.params.id;
      
      // Get product
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Update product with new image URL
      const currentImages = product.images || [];
      const updatedImages = [...currentImages, imageUrl];
      
      const updatedProduct = await curalinaStorage.updateProduct(productId, {
        images: updatedImages
      });

      res.json({ 
        success: true, 
        imageUrl,
        product: updatedProduct
      });
    } catch (error) {
      console.error("Error confirming image upload:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  // Upload product image to S3 (LEGACY - slower server relay method, kept for backward compatibility)
  app.post('/api/admin/products/:id/upload-image', isAuthenticated, isAdmin, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const productId = req.params.id;
      
      // Get product to retrieve SKU
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Generate S3 key and upload
      const s3Key = generateProductImageKey(product.sku, req.file.originalname);
      const imageUrl = await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

      // Update product with new image URL
      const currentImages = product.images || [];
      const updatedImages = [...currentImages, imageUrl];
      
      const updatedProduct = await curalinaStorage.updateProduct(productId, {
        images: updatedImages
      });

      res.json({ 
        success: true, 
        imageUrl,
        product: updatedProduct
      });
    } catch (error) {
      console.error("Error uploading product image:", error);
      
      // Return validation errors with 400 status
      if (error instanceof Error) {
        // Check if it's a validation error (from validateUpload)
        if (error.message.includes('File size exceeds') || error.message.includes('File type')) {
          return res.status(400).json({ error: error.message });
        }
      }
      
      // All other errors are server errors
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // AI-powered folder name matching
  app.post('/api/admin/products/ai-match-folders', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { folderNames } = req.body;
      
      if (!Array.isArray(folderNames) || folderNames.length === 0) {
        return res.status(400).json({ error: "folderNames must be a non-empty array" });
      }

      // Get all products for matching
      const products = await curalinaStorage.getAllProducts();
      
      // Use AI to match folders to products
      const { matchFoldersToProducts } = await import('./services/gemini-ai');
      const matches = await matchFoldersToProducts(
        folderNames,
        products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))
      );

      res.json({ matches });
    } catch (error) {
      console.error("Error matching folders:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to match folders" });
    }
  });

  // Bulk CSV/Excel import
  app.post('/api/admin/products/import-csv', isAuthenticated, isAdmin, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { read, utils } = await import('xlsx');
      
      // Parse the file
      const workbook = read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        return res.status(400).json({ error: "File is empty or has no valid data" });
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of data as any[]) {
        try {
          // Get or create category
          const categoryName = row['Furniture Category'] || 'Furniture';
          const firstCategory = categoryName.split(',')[0].trim();
          let category = await curalinaStorage.getCategoryByName(firstCategory);
          
          if (!category) {
            category = await curalinaStorage.createCategory({
              name: firstCategory,
              type: 'furniture',
              slug: firstCategory.toLowerCase().replace(/\s+/g, '-'),
            });
          }

          // Get or create supplier
          const supplierName = row.Supplier || 'Unknown Supplier';
          let supplier = await curalinaStorage.getSupplierByName(supplierName);
          
          if (!supplier) {
            supplier = await curalinaStorage.createSupplier({
              name: supplierName,
              email: `${supplierName.toLowerCase().replace(/\s+/g, '')}@supplier.com`,
            });
          }

          // Check if product already exists by SKU
          const sku = row.SKU || `PRODUCT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const existingProduct = await curalinaStorage.getProductBySku(sku);

          // Parse retail price
          let price = 0;
          const priceField = row['Retail Price'];
          if (typeof priceField === 'string') {
            price = parseFloat(priceField.replace(/[$,]/g, '')) || 0;
          } else {
            price = Number(priceField) || 0;
          }

          // Parse trade price
          let tradePrice = null;
          const tradePriceField = row['Trade Price '] || row['Trade Price'];
          if (tradePriceField) {
            if (typeof tradePriceField === 'string') {
              tradePrice = parseFloat(tradePriceField.replace(/[$,]/g, '')) || null;
            } else {
              tradePrice = Number(tradePriceField) || null;
            }
          }

          // Parse dimensions - supports multiple field formats
          let dimensions = null;
          const dimString = row['General Dimensions (Inch)\r\nWidth x Depth x Height'] || row['General Dimensions (Inch)'];
          
          // Start with general dimensions
          if (dimString) {
            const matches = dimString.match(/(\d+\.?\d*)\s*"\s*W\s*X\s*(\d+\.?\d*)\s*"\s*D\s*X\s*(\d+\.?\d*)\s*"\s*H/i);
            if (matches) {
              dimensions = {
                w: parseFloat(matches[1]),
                d: parseFloat(matches[2]),
                h: parseFloat(matches[3]),
                unit: 'inches'
              };
            }
          }
          
          // Parse individual dimension fields (override or supplement)
          const parseNumeric = (val: any) => val ? parseFloat(String(val).replace(/[^0-9.]/g, '')) || null : null;
          
          const heightVal = parseNumeric(row['Dimensions (Height)']);
          const widthVal = parseNumeric(row['Dimensions (Width)']);
          const depthVal = parseNumeric(row['Dimensions (Depth)']);
          const armWidthVal = parseNumeric(row['Arm Width']);
          const armDepthVal = parseNumeric(row['Arm Depth']);
          const seatWidthVal = parseNumeric(row['Seat Width']);
          const seatDepthVal = parseNumeric(row['Seat Depth']);
          
          // If individual dimensions provided, use or merge them
          if (heightVal || widthVal || depthVal || armWidthVal || armDepthVal || seatWidthVal || seatDepthVal) {
            dimensions = {
              ...dimensions,
              w: widthVal || dimensions?.w || null,
              d: depthVal || dimensions?.d || null,
              h: heightVal || dimensions?.h || null,
              armWidth: armWidthVal || null,
              armDepth: armDepthVal || null,
              seatWidth: seatWidthVal || null,
              seatDepth: seatDepthVal || null,
              unit: 'inches'
            };
          }

          // Parse colors
          const colorField = row.Colour || row.Color;
          const colorArray = colorField ? colorField.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
          
          // Parse materials
          const materialField = row['Product Material'];
          const materialArray = materialField ? materialField.split(',').map((m: string) => m.trim()).filter(Boolean) : [];
          
          // Parse room types
          const roomTypeField = row['Room Type'];
          const roomTypeArray = roomTypeField ? roomTypeField.split(',').map((r: string) => r.trim()).filter(Boolean) : [];
          
          // Parse design styles (keep separate from styleTags)
          const designStyleField = row['Design Style'];
          const designStyleArray = designStyleField ? designStyleField.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          
          // Parse key features
          const keyFeaturesField = row['Key Features'];
          const keyFeaturesArray = keyFeaturesField ? keyFeaturesField.split(',').map((f: string) => f.trim()).filter(Boolean) : [];
          
          // Parse tags (separate from designStyle)
          const tagsField = row.Tags;
          const tagsArray = tagsField ? tagsField.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
          
          // Combine design styles and tags for styleTags (for backward compatibility)
          const styleSet = new Set([...designStyleArray, ...tagsArray]);
          const styleTags = Array.from(styleSet).slice(0, 10);

          // Parse inventory (ensure valid integer or null)
          const inventoryValue = row.Inventory ? (parseInt(row.Inventory) || null) : null;
          
          // Parse lead time (ensure valid integer or null)
          const leadTimeValue = row['LEAD Time'] || row['Lead Time'];
          const parsedLeadTime = leadTimeValue ? (parseInt(leadTimeValue) || null) : null;
          
          // Parse seating capacity
          const seatingValue = row.Seating || null;
          
          // Parse delivery fields
          const deliveryOptions = row['Delivery Options'] || null;
          const deliveryLocation = row['Delivery Location'] || null;
          const deliveryPolicy = row['Delivery Policy'] || null;

          // Create or update product based on existence
          const productName = row['Product Name'] || 'Unknown Product';
          const productData = {
            name: productName,
            description: row.Overview || '',
            categoryId: category.id,
            supplierId: supplier.id,
            tradePrice: tradePrice ? tradePrice.toFixed(2) : null,
            price: price.toFixed(2),
            discount: "0",
            roomType: roomTypeArray,
            designStyle: designStyleArray,
            styleTags,
            keyFeatures: keyFeaturesArray,
            storageSolutions: row['Storage Solutions'] || null,
            colors: colorArray,
            materials: materialArray,
            dimensions,
            weight: row['Weight (lbs) '] || row['Weight (lbs)'] || row.Weight || null,
            seating: seatingValue,
            assembly: row.Assembly || null,
            inventory: inventoryValue,
            leadTime: parsedLeadTime,
            availability: (inventoryValue && inventoryValue > 0) ? 'in_stock' : 'preorder',
            tags: tagsArray,
            sourceFile: row['Source File'] || null,
            shipping: { 
              cost: 0, 
              eta: parsedLeadTime ? `${parsedLeadTime} days` : '5-7 business days',
              deliveryOptions,
              deliveryLocation,
              deliveryPolicy
            },
            seoMeta: { 
              title: productName, 
              description: row.Overview ? row.Overview.substring(0, 160) : '' 
            },
          };

          if (existingProduct) {
            // Update existing product (preserves images and other fields not in CSV)
            await curalinaStorage.updateProduct(existingProduct.id, productData);
            skipped++;
          } else {
            // Create new product
            await curalinaStorage.createProduct({
              sku,
              ...productData,
              images: [],
              asset3dUrl: null,
              slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + String(sku).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            });
            imported++;
          }
        } catch (error) {
          console.error(`Error importing row:`, error);
          errors.push(`Row ${imported + skipped + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        updated: skipped,
        errors,
        details: `Processed ${data.length} rows. Imported ${imported} new products, updated ${skipped} existing products.`
      });
    } catch (error) {
      console.error("Error processing CSV import:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to process import file",
        imported: 0,
        skipped: 0,
        errors: []
      });
    }
  });

  // Sync Front View images from S3 to database
  app.post('/api/admin/products/sync-s3-front-views', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('🔍 Starting S3 Front View sync...');
      
      // List all objects in the S3 bucket
      const { listS3Objects } = await import('./s3');
      const allObjects = await listS3Objects('products/');
      
      console.log(`📦 Found ${allObjects.length} total objects in S3`);
      
      // Filter for Front View images (case-insensitive)
      const frontViewImages = allObjects.filter(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('front-view') || 
               lowerKey.includes('front_view') || 
               lowerKey.includes('frontview');
      });
      
      console.log(`🎯 Found ${frontViewImages.length} Front View images in S3`);
      
      // Get all products for matching
      const products = await curalinaStorage.getAllProducts();
      console.log(`📊 Total products in database: ${products.length}`);
      
      let updated = 0;
      let skipped = 0;
      let errors: string[] = [];
      
      // Helper to clean SKU for matching
      const cleanSku = (sku: string): string => {
        return String(sku)
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, '-')
          .replace(/^-|-$/g, '');
      };
      
      // Create maps for faster lookup
      const productIdMap = new Map<string, string>();
      const productCacheMap = new Map<string, typeof products[0]>();
      
      for (const product of products) {
        const cleaned = cleanSku(product.sku);
        productIdMap.set(cleaned, product.id);
        productCacheMap.set(product.id, product);
      }
      
      // Track products that have been updated (need fresh fetch for multiple images)
      const updatedProductIds = new Set<string>();
      
      // Process each Front View image
      for (const s3Key of frontViewImages) {
        try {
          // Extract SKU from S3 key: products/{sku}/front-view.jpg
          const parts = s3Key.split('/');
          if (parts.length < 3) {
            console.log(`⚠️ Skipping invalid S3 key: ${s3Key}`);
            skipped++;
            continue;
          }
          
          const skuFromPath = parts[1]; // Second part is the SKU
          const cleanedSku = cleanSku(skuFromPath);
          
          // Find matching product ID
          const productId = productIdMap.get(cleanedSku);
          
          if (!productId) {
            console.log(`⚠️ No product found for SKU: ${skuFromPath} (cleaned: ${cleanedSku})`);
            skipped++;
            continue;
          }
          
          // Get product - if already updated, fetch fresh; otherwise use cache
          let product;
          if (updatedProductIds.has(productId)) {
            // Product was already updated, fetch fresh data to avoid stale cache
            product = await curalinaStorage.getProduct(productId);
            if (product) {
              productCacheMap.set(productId, product);
            }
          } else {
            // First time seeing this product, use cached data
            product = productCacheMap.get(productId);
          }
          
          if (!product) {
            console.log(`⚠️ Product ${productId} no longer exists`);
            skipped++;
            continue;
          }
          
          // Build the public URL
          const BUCKET_NAME = "curalina";
          const AWS_REGION = process.env.AWS_REGION === "global" ? "us-east-1" : (process.env.AWS_REGION || "us-east-1");
          const imageUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
          
          // Check if image already exists in product's images array
          const existingImages = product.images || [];
          if (existingImages.includes(imageUrl)) {
            console.log(`✓ Image already exists for ${product.sku}`);
            skipped++;
            continue;
          }
          
          // Add Front View image to the BEGINNING of the images array (prioritize it)
          const updatedImages = [imageUrl, ...existingImages];
          
          // Update product in database
          await curalinaStorage.updateProduct(product.id, {
            images: updatedImages
          });
          
          // Mark this product as updated and refresh cache
          updatedProductIds.add(productId);
          productCacheMap.set(productId, { ...product, images: updatedImages });
          
          console.log(`✅ Added Front View to ${product.sku} (${product.name})`);
          updated++;
          
        } catch (error) {
          const errorMsg = `Error processing ${s3Key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
      
      console.log(`✨ Sync complete! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors.length}`);
      
      res.json({
        success: true,
        updated,
        skipped,
        errors,
        totalFrontViewsInS3: frontViewImages.length,
        totalProducts: products.length,
        message: `Successfully synced ${updated} Front View images from S3 to database`
      });
      
    } catch (error) {
      console.error('❌ Error syncing S3 Front Views:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync S3 Front Views',
        updated: 0,
        skipped: 0,
        errors: []
      });
    }
  });

  // Public asset serving endpoint
  app.get('/public-objects/:filePath(*)', async (req, res) => {
    try {
      let filePath = req.params.filePath;
      // Decode URL-encoded path components
      filePath = decodeURIComponent(filePath);
      
      const file = await objectStorageService.searchPublicObject(filePath);
      
      if (!file) {
        console.warn(`File not found in object storage: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
      }
      
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving public object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve file" });
      }
    }
  });

  // File upload endpoint - supports multiple files
  app.post('/api/upload', upload.array('files', 10), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const folder = req.body.folder || 'uploads';
      const uploadedUrls: string[] = [];

      // Upload each file to object storage
      for (const file of req.files) {
        // Sanitize filename: remove spaces and special characters
        const sanitizedName = file.originalname
          .toLowerCase()
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/[^a-z0-9.\-_]/g, ''); // Remove special characters
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
        
        // Use public directory so files are accessible via /public-objects route
        const publicPaths = objectStorageService.getPublicObjectSearchPaths();
        const publicDir = publicPaths[0]; // Use first public path
        const objectPath = `${publicDir}/${folder}/${fileName}`;

        // Upload to object storage
        const { bucketName, objectName } = parseObjectPath(objectPath);
        const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
        const storageFile = bucket.file(objectName);

        await storageFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
          },
        });
        
        // URL encode the file path for proper browser handling
        const encodedFileName = encodeURIComponent(fileName);
        const publicUrl = `/public-objects/${folder}/${encodedFileName}`;
        uploadedUrls.push(publicUrl);
      }
      
      res.json({ urls: uploadedUrls });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  // File delete endpoint (admin only)
  app.post('/api/delete-file', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Invalid file URL" });
      }

      // Parse URL to get the file path
      // URL format: /public-objects/folder/filename
      const urlMatch = url.match(/^\/public-objects\/(.+)$/);
      if (!urlMatch) {
        return res.status(400).json({ error: "Invalid file URL format" });
      }

      const filePath = urlMatch[1];

      // Security: Prevent path traversal attacks
      // 1. Reject any path segments containing '..' or leading/trailing slashes
      if (filePath.includes('..') || filePath.includes('\\') || filePath.startsWith('/') || filePath.endsWith('/')) {
        return res.status(400).json({ error: "Invalid file path: path traversal detected" });
      }

      // 2. Whitelist allowed folders (only allow deletion from specific folders)
      const allowedFolders = ['products', 'uploads'];
      const pathSegments = filePath.split('/');
      const folderName = pathSegments[0];

      if (!allowedFolders.includes(folderName)) {
        return res.status(400).json({ error: "Invalid folder: deletion only allowed from approved folders" });
      }

      // 3. Ensure path has at least folder/filename structure
      if (pathSegments.length < 2) {
        return res.status(400).json({ error: "Invalid file path: must include folder and filename" });
      }

      // Construct object storage path
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const publicDir = publicPaths[0];
      const objectPath = `${publicDir}/${filePath}`;

      // Delete from object storage
      const { bucketName, objectName } = parseObjectPath(objectPath);
      const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists before deleting
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "File not found" });
      }

      // Delete the file
      await file.delete();

      // Log deletion for audit trail
      console.log(`[AUDIT] Admin ${req.user?.email || 'unknown'} deleted file: ${filePath}`);

      res.json({ success: true });
    } catch (error) {
      console.error("File delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Product endpoints
  app.get('/api/products', async (req, res) => {
    try {
      const { categoryId, styleTags } = req.query;
      
      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (styleTags) {
        filters.styleTags = (styleTags as string).split(',');
      }
      
      const products = await curalinaStorage.getAllProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const product = await curalinaStorage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Gemini-only analysis for front view + combined (Admin only)
  app.post('/api/admin/products/analyze-with-gemini', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('\n🎨 Starting Gemini-only product analysis...');
      
      const allProducts = await curalinaStorage.getAllProducts();
      const productsWithImages = allProducts.filter(p => 
        p.images && p.images.length > 0 && p.images[0].startsWith('https://curalina')
      );
      
      console.log(`Found ${productsWithImages.length} products with valid images`);
      
      if (productsWithImages.length === 0) {
        return res.json({ 
          success: true, 
          message: 'No products with images found',
          analyzed: 0
        });
      }
      
      res.json({ 
        success: true, 
        message: `Gemini analysis started for ${productsWithImages.length} products. Check server logs for progress.`,
        totalProducts: productsWithImages.length
      });
      
      (async () => {
        try {
          const { batchAnalyzeProductsWithGemini } = await import('./services/gemini-product-analyzer');
          
          const MAX_BATCH_SIZE = 20;
          const productsToAnalyze = productsWithImages
            .slice(0, MAX_BATCH_SIZE)
            .map(p => ({
              sku: p.sku,
              name: p.name,
              images: p.images || []
            }));
          
          if (productsWithImages.length > MAX_BATCH_SIZE) {
            console.log(`⚠️ Limiting to ${MAX_BATCH_SIZE} products (${productsWithImages.length} total)`);
          }
          
          const results = await batchAnalyzeProductsWithGemini(productsToAnalyze);
          
          let updated = 0;
          let failed = 0;
          
          for (const result of results) {
            if (result.success) {
              try {
                const product = allProducts.find(p => p.sku === result.sku);
                if (product) {
                  await curalinaStorage.updateProduct(product.id, {
                    visualDescriptionGemini: result.visualDescriptionGemini,
                    visualDescriptionFrontViewGemini: result.visualDescriptionFrontViewGemini,
                    visualDescription: result.visualDescriptionGemini || result.visualDescriptionFrontViewGemini
                  });
                  updated++;
                  console.log(`✅ Updated ${result.sku}`);
                  if (result.visualDescriptionFrontViewGemini) {
                    console.log(`   Front View: ${result.visualDescriptionFrontViewGemini.length} chars`);
                  }
                  if (result.visualDescriptionGemini) {
                    console.log(`   Combined: ${result.visualDescriptionGemini.length} chars`);
                  }
                }
              } catch (error) {
                console.error(`Failed to update ${result.sku}:`, error);
                failed++;
              }
            } else {
              failed++;
            }
          }
          
          console.log(`\n📊 Gemini-Only Analysis Complete:`);
          console.log(`  ✅ Updated: ${updated}`);
          console.log(`  ❌ Failed: ${failed}`);
        } catch (error) {
          console.error('Gemini batch analysis error:', error);
        }
      })();
      
    } catch (error) {
      console.error("Error starting Gemini analysis:", error);
      res.status(500).json({ error: "Failed to start Gemini analysis" });
    }
  });

  // Legacy route - redirect to new Gemini-only endpoint
  app.post('/api/admin/products/analyze-visuals', isAuthenticated, isAdmin, async (req: any, res) => {
    res.status(410).json({ 
      error: "This endpoint has been deprecated. Use '/api/admin/products/analyze-with-gemini' instead.",
      message: "OpenAI analysis has been removed. Platform now uses Gemini AI exclusively."
    });
  });

  // Visual Analysis Jobs API (Admin only) - NOW USES COMPREHENSIVE ANALYZER
  app.post('/api/admin/visual-analysis/start', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { productIds = [], onlyMissingDescriptions = false } = req.body;
      
      console.log(`\n🎨 Comprehensive Analysis Started (${productIds.length || 'all'} products)`);
      
      const { analyzeProductComprehensively } = await import('./services/comprehensive-visual-analyzer');
      const { EnhancedQualityScorer } = await import('./services/enhanced-quality-scorer');
      
      // Get products to analyze
      let productsToAnalyze: Product[] = [];
      if (productIds && productIds.length > 0) {
        productsToAnalyze = await Promise.all(
          productIds.map(id => curalinaStorage.getProduct(id))
        ).then(results => results.filter((p): p is Product => p !== null));
      } else {
        const allProducts = await curalinaStorage.getAllProducts();
        productsToAnalyze = onlyMissingDescriptions 
          ? allProducts.filter(p => !p.structuredAnalysis)
          : allProducts;
      }
      
      if (productsToAnalyze.length === 0) {
        return res.json({ 
          success: true,
          analyzed: 0,
          message: 'No products to analyze'
        });
      }
      
      // Start analysis in background
      const results = [];
      (async () => {
        for (const product of productsToAnalyze) {
          try {
            console.log(`\n📸 Analyzing: ${product.name} (${product.sku})`);
            
            const analysis = await analyzeProductComprehensively(product.name, product.images);
            if (!analysis) {
              console.warn(`  ❌ No valid images for ${product.sku}`);
              continue;
            }
            
            const metrics = EnhancedQualityScorer.calculateMetrics(analysis.frontViewAnalysis);
            
            const structuredData = {
              frontView: analysis.frontViewAnalysis,
              multiAngle: analysis.synthesizedAnalysis,
              analysisDate: new Date().toISOString(),
              geminiVersion: 'gemini-2.5-flash'
            };
            
            await curalinaStorage.updateProductStructuredAnalysis(
              product.id,
              structuredData,
              metrics.overallScore
            );
            
            console.log(`  ✅ Score: ${metrics.overallScore}/100 (${metrics.regenerationReadiness})`);
            
            results.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              score: metrics.overallScore,
              readiness: metrics.regenerationReadiness
            });
          } catch (error) {
            console.error(`  ❌ Failed to analyze ${product.sku}:`, error);
            results.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        console.log(`\n✅ Batch analysis complete: ${results.length}/${productsToAnalyze.length} analyzed`);
      })();
      
      res.json({ 
        success: true,
        totalProducts: productsToAnalyze.length,
        message: `Comprehensive analysis started for ${productsToAnalyze.length} products. Check server logs for progress.`,
        version: 'comprehensive-v3'
      });
      
    } catch (error) {
      console.error("Error starting visual analysis job:", error);
      res.status(500).json({ error: "Failed to start visual analysis" });
    }
  });
  
  app.get('/api/admin/visual-analysis/active', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { visualAnalysisConfig } = await import('./config/visual-analysis');
      const servicePath = visualAnalysisConfig.useV2 
        ? './services/visual-analysis-job-service-v2'
        : './services/visual-analysis-job-service';
      
      const { getActiveVisualAnalysisJobs } = await import(servicePath);
      const jobs = await getActiveVisualAnalysisJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching active visual analysis jobs:", error);
      res.status(500).json({ error: "Failed to fetch active jobs" });
    }
  });
  
  app.get('/api/admin/visual-analysis/job/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { visualAnalysisConfig } = await import('./config/visual-analysis');
      const servicePath = visualAnalysisConfig.useV2 
        ? './services/visual-analysis-job-service-v2'
        : './services/visual-analysis-job-service';
      
      const { getVisualAnalysisJobDetails } = await import(servicePath);
      const details = await getVisualAnalysisJobDetails(req.params.id);
      
      if (!details) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json(details);
    } catch (error) {
      console.error("Error fetching visual analysis job details:", error);
      res.status(500).json({ error: "Failed to fetch job details" });
    }
  });

  // Bulk re-analyze products that need analysis - NOW USES COMPREHENSIVE ANALYZER
  // Analyzes: 1) Products with Front View images, 2) Single-image products, 3) Missing structured analysis
  app.post('/api/admin/visual-analysis/reanalyze-front-views', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('\n🎨 Comprehensive Analysis: Finding products to re-analyze...');
      
      const allProducts = await curalinaStorage.getAllProducts();
      
      // Filter products that need comprehensive analysis
      const productsToAnalyze = allProducts.filter(product => {
        if (!product.images || product.images.length === 0) return false;
        
        const hasFrontView = product.images.some(url => 
          url.toLowerCase().includes('front')
        );
        const hasSingleImage = product.images.length === 1;
        const missingAnalysis = !product.structuredAnalysis;
        
        return (hasFrontView || hasSingleImage) && missingAnalysis;
      });
      
      console.log(`📊 Found ${productsToAnalyze.length} products needing analysis`);
      
      if (productsToAnalyze.length === 0) {
        return res.json({
          success: true,
          message: 'No products need analysis',
          totalProducts: 0
        });
      }
      
      const { analyzeProductComprehensively } = await import('./services/comprehensive-visual-analyzer');
      const { EnhancedQualityScorer } = await import('./services/enhanced-quality-scorer');
      
      // Start analysis in background
      const results = [];
      (async () => {
        for (const product of productsToAnalyze) {
          try {
            console.log(`  📸 ${product.name}`);
            
            const analysis = await analyzeProductComprehensively(product.name, product.images);
            if (!analysis) continue;
            
            const metrics = EnhancedQualityScorer.calculateMetrics(analysis.frontViewAnalysis);
            
            const structuredData = {
              frontView: analysis.frontViewAnalysis,
              multiAngle: analysis.synthesizedAnalysis,
              analysisDate: new Date().toISOString(),
              geminiVersion: 'gemini-2.5-flash'
            };
            
            await curalinaStorage.updateProductStructuredAnalysis(
              product.id,
              structuredData,
              metrics.overallScore
            );
            
            console.log(`    ✅ Score: ${metrics.overallScore}/100`);
            
            results.push({
              id: product.id,
              sku: product.sku,
              score: metrics.overallScore,
              readiness: metrics.regenerationReadiness
            });
          } catch (error) {
            console.error(`    ❌ ${product.sku}:`, error);
          }
        }
        console.log(`\n✅ Re-analysis complete: ${results.length} products updated`);
      })();
      
      res.json({ 
        success: true,
        totalProducts: productsToAnalyze.length,
        message: `Comprehensive analysis started for ${productsToAnalyze.length} products. Check server logs for progress.`,
        version: 'comprehensive-v3'
      });
      
    } catch (error) {
      console.error("Error starting re-analysis:", error);
      res.status(500).json({ error: "Failed to start re-analysis" });
    }
  });

  // Generate text-based descriptions for products without visual analysis (Admin only)
  app.post('/api/admin/products/generate-descriptions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('\n📝 Starting text-based description generation...');
      
      // Get all products without visualDescription
      const allProducts = await curalinaStorage.getAllProducts();
      const productsNeedingDescription = allProducts.filter(p => !p.visualDescription);
      
      console.log(`Found ${productsNeedingDescription.length} products without visual descriptions`);
      console.log(`Total products in database: ${allProducts.length}`);
      
      if (productsNeedingDescription.length === 0) {
        return res.json({ 
          success: true, 
          message: 'All products already have descriptions',
          generated: 0,
          total: allProducts.length
        });
      }
      
      // Start async generation
      res.json({ 
        success: true, 
        message: `Description generation started for ${productsNeedingDescription.length} products. Check server logs for progress.`,
        totalProducts: productsNeedingDescription.length
      });
      
      // Run generation in background
      (async () => {
        try {
          const { generateRichProductDescription } = await import('./services/product-text-description-generator');
          
          let updated = 0;
          let failed = 0;
          
          for (const product of productsNeedingDescription) {
            try {
              const richDescription = generateRichProductDescription(product);
              
              await curalinaStorage.updateProduct(product.id, {
                visualDescription: richDescription
              });
              
              updated++;
              console.log(`✅ Generated description for ${product.sku} (${updated}/${productsNeedingDescription.length})`);
              
            } catch (error) {
              console.error(`Failed to generate description for ${product.sku}:`, error);
              failed++;
            }
          }
          
          console.log(`\n📊 Text-Based Description Generation Complete:`);
          console.log(`  ✅ Generated: ${updated}`);
          console.log(`  ❌ Failed: ${failed}`);
          console.log(`  📈 Coverage: ${((updated / allProducts.length) * 100).toFixed(1)}% of all products now have descriptions`);
        } catch (error) {
          console.error('Description generation error:', error);
        }
      })();
      
    } catch (error) {
      console.error("Error starting text-based description generation:", error);
      res.status(500).json({ error: "Failed to start description generation" });
    }
  });

  app.get('/api/products/alternatives/:id', async (req, res) => {
    try {
      const alternatives = await curalinaStorage.getProductAlternatives(req.params.id);
      res.json(alternatives);
    } catch (error) {
      console.error("Error fetching alternatives:", error);
      res.status(500).json({ error: "Failed to fetch alternatives" });
    }
  });

  // AI Training Data endpoints (Admin only)
  // Design Examples
  app.get('/api/admin/design-examples', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { type, roomType } = req.query;
      const filters: any = {};
      if (type) filters.type = type as 'good' | 'bad';
      if (roomType) filters.roomType = roomType as string;
      
      const examples = await curalinaStorage.getAllDesignExamples(filters);
      res.json(examples);
    } catch (error) {
      console.error("Error fetching design examples:", error);
      res.status(500).json({ error: "Failed to fetch design examples" });
    }
  });

  app.post('/api/admin/design-examples', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertDesignExampleSchema.parse(req.body);
      const example = await curalinaStorage.createDesignExample(validatedData);
      res.json(example);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid design example data", details: error.errors });
      }
      console.error("Error creating design example:", error);
      res.status(500).json({ error: "Failed to create design example" });
    }
  });

  app.patch('/api/admin/design-examples/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const example = await curalinaStorage.updateDesignExample(req.params.id, req.body);
      res.json(example);
    } catch (error) {
      console.error("Error updating design example:", error);
      res.status(500).json({ error: "Failed to update design example" });
    }
  });

  app.delete('/api/admin/design-examples/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteDesignExample(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting design example:", error);
      res.status(500).json({ error: "Failed to delete design example" });
    }
  });

  // Product Packages
  app.get('/api/admin/product-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { roomType, active } = req.query;
      const filters: any = {};
      if (roomType) filters.roomType = roomType as string;
      if (active !== undefined) filters.active = active === 'true';
      
      const packages = await curalinaStorage.getAllProductPackages(filters);
      res.json(packages);
    } catch (error) {
      console.error("Error fetching product packages:", error);
      res.status(500).json({ error: "Failed to fetch product packages" });
    }
  });

  app.post('/api/admin/product-packages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertProductPackageSchema.parse(req.body);
      const pkg = await curalinaStorage.createProductPackage(validatedData);
      res.json(pkg);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product package data", details: error.errors });
      }
      console.error("Error creating product package:", error);
      res.status(500).json({ error: "Failed to create product package" });
    }
  });

  app.patch('/api/admin/product-packages/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const pkg = await curalinaStorage.updateProductPackage(req.params.id, req.body);
      res.json(pkg);
    } catch (error) {
      console.error("Error updating product package:", error);
      res.status(500).json({ error: "Failed to update product package" });
    }
  });

  app.delete('/api/admin/product-packages/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteProductPackage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product package:", error);
      res.status(500).json({ error: "Failed to delete product package" });
    }
  });

  // Placement Guidelines
  app.get('/api/admin/placement-guidelines', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { roomType, productCategory } = req.query;
      const filters: any = {};
      if (roomType) filters.roomType = roomType as string;
      if (productCategory) filters.productCategory = productCategory as string;
      
      const guidelines = await curalinaStorage.getAllPlacementGuidelines(filters);
      res.json(guidelines);
    } catch (error) {
      console.error("Error fetching placement guidelines:", error);
      res.status(500).json({ error: "Failed to fetch placement guidelines" });
    }
  });

  app.post('/api/admin/placement-guidelines', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertPlacementGuidelineSchema.parse(req.body);
      const guideline = await curalinaStorage.createPlacementGuideline(validatedData);
      res.json(guideline);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid placement guideline data", details: error.errors });
      }
      console.error("Error creating placement guideline:", error);
      res.status(500).json({ error: "Failed to create placement guideline" });
    }
  });

  app.patch('/api/admin/placement-guidelines/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const guideline = await curalinaStorage.updatePlacementGuideline(req.params.id, req.body);
      res.json(guideline);
    } catch (error) {
      console.error("Error updating placement guideline:", error);
      res.status(500).json({ error: "Failed to update placement guideline" });
    }
  });

  app.delete('/api/admin/placement-guidelines/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deletePlacementGuideline(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting placement guideline:", error);
      res.status(500).json({ error: "Failed to delete placement guideline" });
    }
  });

  // Design Rules
  app.get('/api/admin/design-rules', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { category, active } = req.query;
      const filters: any = {};
      if (category) filters.category = category as string;
      if (active !== undefined) filters.active = active === 'true';
      
      const rules = await curalinaStorage.getAllDesignRules(filters);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching design rules:", error);
      res.status(500).json({ error: "Failed to fetch design rules" });
    }
  });

  app.post('/api/admin/design-rules', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertDesignRuleSchema.parse(req.body);
      const rule = await curalinaStorage.createDesignRule(validatedData);
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid design rule data", details: error.errors });
      }
      console.error("Error creating design rule:", error);
      res.status(500).json({ error: "Failed to create design rule" });
    }
  });

  app.patch('/api/admin/design-rules/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const rule = await curalinaStorage.updateDesignRule(req.params.id, req.body);
      res.json(rule);
    } catch (error) {
      console.error("Error updating design rule:", error);
      res.status(500).json({ error: "Failed to update design rule" });
    }
  });

  app.delete('/api/admin/design-rules/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteDesignRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting design rule:", error);
      res.status(500).json({ error: "Failed to delete design rule" });
    }
  });

  // Quiz endpoint
  app.post('/api/quiz', async (req, res) => {
    try {
      const validatedData = insertQuizResponseSchema.parse(req.body);
      
      // If vibe images are present, analyze them to extract visual preferences
      let vibePreferences = {};
      if (validatedData.vibeImages && validatedData.vibeImages.length > 0) {
        console.log(`🎨 Analyzing ${validatedData.vibeImages.length} vibe image(s) to extract visual preferences...`);
        const { analyzeVibeImages } = await import('./services/gemini-ai');
        
        try {
          const analysis = await analyzeVibeImages(validatedData.vibeImages);
          vibePreferences = {
            vibeColorPalette: analysis.colorPalette,
            vibeMaterials: analysis.materials,
            vibeTextures: analysis.textures,
            vibeLightingTone: analysis.lightingTone,
            vibeDensity: analysis.density,
            vibeOverallDescription: analysis.overallVibe,
          };
          console.log(`✅ Vibe image analysis complete:`, {
            colors: analysis.colorPalette.length,
            materials: analysis.materials.length,
            textures: analysis.textures.length,
            tone: analysis.lightingTone,
            density: analysis.density
          });
        } catch (error) {
          console.error("Error analyzing vibe images:", error);
          // Continue without vibe preferences if analysis fails
        }
      }
      
      // Create quiz response with vibe preferences
      const quiz = await curalinaStorage.createQuizResponse({
        ...validatedData,
        ...vibePreferences
      });
      
      res.json(quiz);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid quiz data", details: error.errors });
      }
      console.error("Error creating quiz response:", error);
      res.status(500).json({ error: "Failed to create quiz response" });
    }
  });

  // Render endpoints
  app.post('/api/render', async (req, res) => {
    try {
      // Validate render data
      const renderData = insertRenderSchema.parse({
        quizResponseId: req.body.quizResponseId,
        sessionId: req.body.sessionId,
        prompt: req.body.prompt || "",
        productSkus: req.body.productSkus || [],
        status: "generating",
      });

      const quiz = await curalinaStorage.getQuizResponse(renderData.quizResponseId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz response not found" });
      }

      // Idempotency check: generate hash from quiz-specific candidate pool
      const { generateSelectionHash, createCandidatePoolSnapshot, initializeSelectionRationale } = await import('./services/selection-ledger-service');
      const { filterProductsByQuiz } = await import('./services/gemini-ai');
      
      // Get all products and filter to quiz-specific candidate pool (for deterministic hash)
      const allProducts = await curalinaStorage.getAllProducts();
      const candidatePool = filterProductsByQuiz(allProducts, quiz);
      console.log(`📊 Candidate pool: ${candidatePool.length} products match quiz criteria`);
      
      // Generate hash from quiz + filtered candidate pool (not full catalog)
      const selectionHash = generateSelectionHash(quiz, candidatePool);
      
      // Check if we already have a ledger with this hash (idempotency)
      const existingLedger = await curalinaStorage.getSelectionLedgerByHash(selectionHash);
      if (existingLedger) {
        console.log(`♻️  Idempotency: Found existing ledger for hash ${selectionHash.substring(0, 8)}...`);
        const existingRender = await curalinaStorage.getRender(existingLedger.renderId);
        
        if (existingRender) {
          // Happy path: ledger and render both exist
          console.log(`♻️  Returning existing render ${existingRender.id} (status: ${existingRender.status})`);
          return res.json(existingRender);
        } else {
          // Orphaned ledger: render was deleted but ledger remains
          console.warn(`⚠️  Orphaned ledger detected (render ${existingLedger.renderId} missing) - deleting orphaned ledger`);
          await curalinaStorage.deleteSelectionLedger(existingLedger.id);
          console.log(`🗑️  Deleted orphaned ledger ${existingLedger.id} - will create fresh render`);
          // Continue to create new render with same hash
        }
      }
      
      console.log(`✨ New selection hash: ${selectionHash.substring(0, 8)}... - creating fresh render`);

      // Create render record with status 'generating' (placeholder prompt)
      const render = await curalinaStorage.createRender({
        ...renderData,
        sessionId: quiz.sessionId,
        prompt: "Generating...",
      });
      
      // Immediately persist 'submitted' lifecycle event
      const { buildRenderEvent } = await import('./services/render-ingestion');
      const submittedEvent = buildRenderEvent(render.id, 'submitted', 'User submitted render request', req.user?.id);
      await curalinaStorage.createRenderEvent(submittedEvent);
      
      // Create initial ledger entry with candidate pool snapshot
      const candidateSnapshot = createCandidatePoolSnapshot(candidatePool);
      const initialRationale = initializeSelectionRationale();
      
      await curalinaStorage.createSelectionLedger({
        renderId: render.id,
        selectionHash,
        candidatePoolSnapshot: candidateSnapshot as any,
        selectionRationale: initialRationale as any,
        compositionOrder: [], // Will be populated after product selection
        lockedAt: null, // Will be locked after successful generation
      });
      
      console.log(`📝 Created ledger with ${candidateSnapshot.length} candidate products`);

      // Return immediately with status 'generating'
      res.json(render);

      // Start async AI generation process
      (async () => {
        const { buildRenderEvent } = await import('./services/render-ingestion');
        const lifecycleEvents: any[] = [];
        
        // Include submitted event in snapshot (already persisted)
        lifecycleEvents.push(submittedEvent);
        
        // Immediately persist 'processing' event
        const processingEvent = buildRenderEvent(render.id, 'processing', 'AI generation started');
        await curalinaStorage.createRenderEvent(processingEvent);
        lifecycleEvents.push(processingEvent);
        
        try {
          console.log(`🎨 Starting AI render for ${quiz.roomType} in ${quiz.style} style`);
          
          // Step 1: Get all products
          const allProducts = await curalinaStorage.getAllProducts();
          console.log(`Found ${allProducts.length} total products`);
          
          // Step 2: Check if specific products were requested (for regeneration with swaps)
          const { filterProductsByQuiz, selectProductsWithAI, buildPromptFromQuiz, analyzeRoomImage, analyzeFloorPlan } = await import('./services/gemini-ai');
          let selectedProducts: Array<{ sku: string; name: string; placement: string; reasoning: string }> = [];
          let placements: PlacementInstruction[] = [];
          
          if (req.body.productSkus && req.body.productSkus.length > 0) {
            // Use specific product SKUs (from swap/regeneration)
            console.log(`Using ${req.body.productSkus.length} specified product SKUs`);
            selectedProducts = req.body.productSkus.map((sku: string) => {
              const product = allProducts.find(p => p.sku === sku);
              return {
                sku,
                name: product?.name || sku,
                placement: "in the room",
                reasoning: "User-specified product"
              };
            });
          } else {
            // AI-driven product selection
            const filteredProducts = filterProductsByQuiz(allProducts, quiz);
            console.log(`Filtered to ${filteredProducts.length} matching products`);
            
            if (filteredProducts.length > 0) {
              const selectionResult = await selectProductsWithAI(filteredProducts, quiz);
              selectedProducts = selectionResult.products;
              placements = selectionResult.placements;
              console.log(`AI selected ${selectedProducts.length} products with ${placements.length} zone-based placements`);
            } else {
              console.warn("No matching products found, generating room without specific products");
            }
          }
          
          // Step 3: Analyze uploaded images with Gemini Vision
          const { identifyVisibleProducts } = await import('./services/gemini-ai');
          const domain = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
          const fullDomain = domain.startsWith('http') ? domain : `https://${domain}`;
          
          let roomAnalysis;
          let floorPlanAnalysis;
          
          // Analyze room photo (vibe image) if provided
          if (quiz.vibeImages && quiz.vibeImages.length > 0) {
            try {
              const vibeImageUrl = `${fullDomain}${quiz.vibeImages[0]}`;
              console.log(`🔍 Analyzing room photo with Gemini Vision...`);
              roomAnalysis = await analyzeRoomImage(vibeImageUrl);
              console.log(`✅ Room analysis complete: ${roomAnalysis.style} style detected`);
            } catch (error) {
              console.error("Room analysis error:", error);
            }
          }
          
          // Analyze floor plan if provided
          let floorplanUrl: string | undefined = undefined;
          if (quiz.floorplanUrl) {
            floorplanUrl = `${fullDomain}${quiz.floorplanUrl}`;
            try {
              console.log(`🔍 Analyzing floor plan with Gemini Vision...`);
              floorPlanAnalysis = await analyzeFloorPlan(floorplanUrl);
              console.log(`✅ Floor plan analysis complete: ${floorPlanAnalysis.roomDimensions}`);
            } catch (error) {
              console.error("Floor plan analysis error:", error);
            }
          }
          
          // Step 4: Enrich selected products with full details AND visual descriptions for better AI generation
          const enrichedProducts = selectedProducts.map(sp => {
            const fullProduct = allProducts.find(p => p.sku === sp.sku);
            if (!fullProduct) return sp;
            
            // Include ALL visual description fields for prioritization
            // Priority system (in buildPromptFromQuiz): Front View → Gemini → legacy
            return {
              ...sp,
              name: fullProduct.name,
              visualDescriptionFrontView: fullProduct.visualDescriptionFrontView || undefined,
              visualDescriptionGemini: fullProduct.visualDescriptionGemini || undefined,
              visualDescription: fullProduct.visualDescription || undefined,
            };
          });
          
          // Count products with visual descriptions (using priority system)
          const productsWithVisuals = enrichedProducts.filter((p: any) => {
            return p.visualDescriptionFrontView || p.visualDescriptionGemini || p.visualDescription;
          }).length;
          
          if (productsWithVisuals > 0) {
            console.log(`✨ ${productsWithVisuals}/${selectedProducts.length} products have visual descriptions (prioritizing Front View → Gemini → Legacy)`);
          }
          
          // Update selection ledger with composition order and category-level rationale
          try {
            const ledger = await curalinaStorage.getSelectionLedgerByRender(render.id);
            if (ledger) {
              const { recordSelection, recordExclusion, calculateDiversityScore, generateCompositionOrder } = await import('./services/selection-ledger-service');
              const { detectFunctionalCategory, getRoomTemplate } = await import('./services/room-composition-service');
              
              // Initialize rationale structure
              let rationale = initializeSelectionRationale();
              const selectedSkus = new Set(selectedProducts.map(p => p.sku));
              const filteredProducts = filterProductsByQuiz(allProducts, quiz);
              
              // Get room template for rules (may be null for unsupported room types)
              const template = getRoomTemplate(quiz.roomType);
              
              // Safe defaults for when template is missing
              const defaultRules = { min: 0, max: 10, priority: 99 };
              
              // Log warning if template is missing (helps identify misconfigurations)
              if (!template) {
                console.warn(`⚠️  No room template found for room type: "${quiz.roomType}" - using default rules for ledger rationale`);
              }
              
              // Categorize and record selected products by functional category
              for (const sp of selectedProducts) {
                const fullProduct = allProducts.find(p => p.sku === sp.sku);
                if (!fullProduct) continue;
                
                // Detect functional categories for this product
                const functionalCategories = detectFunctionalCategory(fullProduct);
                
                // Record selection for each functional category this product belongs to
                for (const category of functionalCategories) {
                  // Safe template access with null guards
                  const isEssential = template?.essentials?.[category as any] !== undefined;
                  let rules = defaultRules;
                  
                  if (template) {
                    if (isEssential && (template.essentials as any)[category]) {
                      rules = (template.essentials as any)[category];
                    } else if (template.complementary && (template.complementary as any)[category]) {
                      rules = (template.complementary as any)[category];
                    }
                  }
                  
                  recordSelection(
                    rationale,
                    category,
                    isEssential,
                    fullProduct,
                    sp.reasoning || (req.body.productSkus ? 'User-specified product' : 'AI-selected for composition'),
                    rules
                  );
                }
                
                // If product has no functional category, add to complementary "uncategorized"
                if (functionalCategories.length === 0) {
                  recordSelection(
                    rationale,
                    'uncategorized',
                    false,
                    fullProduct,
                    'No functional category detected',
                    defaultRules
                  );
                }
              }
              
              // Record exclusions (products in candidate pool but not selected)
              for (const product of filteredProducts) {
                if (!selectedSkus.has(product.sku)) {
                  recordExclusion(rationale, product, 'Not selected by AI during composition');
                }
              }
              
              // Calculate diversity score using the proper function
              const diversityScore = calculateDiversityScore(rationale);
              rationale.diversityScore = diversityScore;
              
              // Generate composition order (essentials first, then complementary, then decor)
              const compositionOrder = generateCompositionOrder(rationale);
              
              // Update ledger with complete details
              await curalinaStorage.updateSelectionLedgerDetails(ledger.id, {
                selectionRationale: rationale,
                compositionOrder,
                diversityScore
              });
              
              const essentialCount = Object.keys(rationale.essentials).length;
              const complementaryCount = Object.keys(rationale.complementary).length;
              console.log(`📋 Updated ledger: ${selectedProducts.length} products in ${essentialCount} essential + ${complementaryCount} complementary categories, ${rationale.excluded.length} exclusions, diversity: ${diversityScore}`);
            }
          } catch (error) {
            console.error("Error updating selection ledger (non-blocking):", error);
          }
          
          // Attach placement metadata from ledger before building prompt
          const { attachPlacementMetadata } = await import('./services/gemini-ai');
          const ledgerData = await curalinaStorage.getSelectionLedgerByRender(render.id) || null;
          const productsWithPlacement = attachPlacementMetadata(
            enrichedProducts,
            ledgerData,
            quiz.roomType,
            allProducts
          );
          
          // Build enhanced prompt with enriched products and image analysis
          const { prompt, productMetadata } = buildPromptFromQuiz(quiz, productsWithPlacement, roomAnalysis, floorPlanAnalysis, placements);
          
          // Log what image analysis was used
          const analysisTypes = [];
          if (roomAnalysis) analysisTypes.push('room photo analysis');
          if (floorPlanAnalysis) analysisTypes.push('floor plan analysis');
          if (floorplanUrl && !roomAnalysis && !floorPlanAnalysis) analysisTypes.push('uploaded image (analysis pending)');
          
          console.log(`📝 Generated prompt with ${analysisTypes.length > 0 ? analysisTypes.join(' + ') : 'no image analysis'}`);
          
          // Generate AI image with detailed product descriptions embedded in prompt
          // Products include rich Gemini Vision analysis (300-400 word descriptions)
          // AI generates furniture matching real products based on these visual specifications
          if (floorplanUrl) {
            console.log(`🖼️ Using Gemini image-to-image mode with uploaded space photo`);
          } else {
            console.log(`🎨 Using Gemini text-to-image mode (no space photo uploaded)`);
          }
          const imageDataUrl = await generateInteriorImage(prompt, floorplanUrl, roomAnalysis, floorPlanAnalysis);
          console.log(`✅ AI-generated room rendering complete`);
          
          // Extract base64 data from data URL (format: data:image/png;base64,...)
          const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
          if (!base64Match) {
            throw new Error("Invalid image data format");
          }
          const base64Data = base64Match[1];
          
          // Convert to buffer for storage
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const imageName = `render-${render.id}-${Date.now()}.png`;
          
          const publicPaths = objectStorageService.getPublicObjectSearchPaths();
          const publicDir = publicPaths[0];
          const objectPath = `${publicDir}/renders/${imageName}`;
          
          const { bucketName, objectName } = parseObjectPath(objectPath);
          const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          
          await file.save(imageBuffer, {
            metadata: {
              contentType: 'image/png',
            },
          });
          
          const imageUrl = `/public-objects/renders/${imageName}`;
          
          // Step 5: Log visibility analysis for debugging (but show all products to users)
          if (selectedProducts.length > 0) {
            try {
              // Convert image buffer to data URL for visibility detection
              const finalImageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
              const visibleProductSkus = await identifyVisibleProducts(finalImageDataUrl, selectedProducts);
              console.log(`🛍️ Visibility analysis: ${visibleProductSkus.length}/${selectedProducts.length} products clearly identified in image`);
              console.log(`   Visible: ${visibleProductSkus.join(', ')}`);
              if (visibleProductSkus.length < selectedProducts.length) {
                const notIdentified = selectedProducts.filter(p => !visibleProductSkus.includes(p.sku)).map(p => p.sku);
                console.log(`   Not clearly visible: ${notIdentified.join(', ')}`);
              }
            } catch (error) {
              console.error("Error in visibility analysis (non-blocking):", error);
            }
          }
          
          // Store ALL selected products (users should see everything the AI recommended)
          const allProductSkus = selectedProducts.map(p => p.sku);
          
          // Update render with completed data (all selected products)
          await curalinaStorage.updateRender(render.id, {
            imageUrl,
            productSkus: allProductSkus,
            productMetadata,
            prompt,
            status: 'completed',
          });
          
          // Immediately persist 'completed' event
          const completedEvent = buildRenderEvent(
            render.id,
            'completed',
            `Render completed with ${allProductSkus.length} products`
          );
          await curalinaStorage.createRenderEvent(completedEvent);
          lifecycleEvents.push(completedEvent);
          
          // Ingest render snapshot (products + immutable event snapshot) atomically into analytics tables
          try {
            const { ingestRenderSnapshot } = await import('./services/render-ingestion');
            // Deep copy events array for immutable snapshot
            const eventSnapshot = JSON.parse(JSON.stringify(lifecycleEvents));
            await ingestRenderSnapshot({
              render,
              productsWithPlacement,
              allProducts,
              ledgerData: ledgerData || null,
              quizContext: {
                roomType: quiz.roomType,
                style: quiz.style,
                budget: quiz.budget
              }
            }, eventSnapshot);
          } catch (error) {
            console.error("❌ Render snapshot ingestion failed (non-blocking):", error);
          }
          
          // Lock selection ledger to prevent modifications
          try {
            const ledger = await curalinaStorage.getSelectionLedgerByRender(render.id);
            if (ledger && !ledger.lockedAt) {
              await curalinaStorage.lockSelectionLedger(ledger.id);
              console.log(`🔒 Locked selection ledger for render ${render.id}`);
            }
          } catch (error) {
            console.error("Error locking selection ledger (non-blocking):", error);
          }
          
          console.log(`✅ Render ${render.id} completed with ${allProductSkus.length} products available in Shop the Look`);
        } catch (error) {
          console.error("AI generation error:", error);
          
          // Update render with failed status
          await curalinaStorage.updateRender(render.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Immediately persist 'failed' event
          const failedEvent = buildRenderEvent(
            render.id,
            'failed',
            error instanceof Error ? error.message : 'Unknown error'
          );
          await curalinaStorage.createRenderEvent(failedEvent);
          lifecycleEvents.push(failedEvent);
          
          // Ingest empty products + event snapshot atomically
          try {
            const eventSnapshot = JSON.parse(JSON.stringify(lifecycleEvents));
            await curalinaStorage.ingestRenderSnapshot(render.id, [], eventSnapshot);
          } catch (eventError) {
            console.error("Error ingesting failed render (non-blocking):", eventError);
          }
        }
      })();
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid render data", details: error.errors });
      }
      console.error("Error creating render:", error);
      res.status(500).json({ error: "Failed to create render" });
    }
  });

  app.get('/api/render/latest', async (req, res) => {
    try {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
      }

      const render = await curalinaStorage.getLatestRenderBySession(sessionId as string);
      if (!render) {
        return res.status(404).json({ error: "No render found" });
      }

      res.json(render);
    } catch (error) {
      console.error("Error fetching latest render:", error);
      res.status(500).json({ error: "Failed to fetch render" });
    }
  });

  app.get('/api/render/:id', async (req, res) => {
    try {
      const render = await curalinaStorage.getRender(req.params.id);
      if (!render) {
        return res.status(404).json({ error: "Render not found" });
      }
      res.json(render);
    } catch (error) {
      console.error("Error fetching render:", error);
      res.status(500).json({ error: "Failed to fetch render" });
    }
  });

  // Get selection ledger for a render (Task 7: Shop the Look composition order)
  app.get('/api/render/:renderId/ledger', async (req, res) => {
    try {
      const ledger = await curalinaStorage.getSelectionLedgerByRender(req.params.renderId);
      if (!ledger) {
        return res.status(404).json({ error: "Selection ledger not found" });
      }
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching selection ledger:", error);
      res.status(500).json({ error: "Failed to fetch selection ledger" });
    }
  });

  app.get('/api/renders', async (req, res) => {
    try {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
      }

      const renders = await curalinaStorage.getRendersBySession(sessionId as string);
      res.json(renders);
    } catch (error) {
      console.error("Error fetching renders:", error);
      res.status(500).json({ error: "Failed to fetch renders" });
    }
  });

  // Render Analytics endpoints (Admin only)
  app.get('/api/admin/renders/analytics', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, roomType, style, limit } = req.query;
      
      // Validate limit parameter
      let validLimit: number | null = null;
      if (limit) {
        const parsedLimit = parseInt(limit as string, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({ error: "Invalid limit parameter. Must be an integer >= 1." });
        }
        validLimit = parsedLimit;
      }
      
      // Build WHERE clause parts
      const whereParts: string[] = [];
      const params: any[] = [];
      
      if (status) {
        params.push(status);
        whereParts.push(`render_status = $${params.length}`);
      }
      
      if (roomType) {
        params.push(roomType);
        whereParts.push(`room_type = $${params.length}`);
      }
      
      if (style) {
        params.push(style);
        whereParts.push(`design_style = $${params.length}`);
      }
      
      // Build full query
      let queryText = 'SELECT * FROM render_analytics_v';
      
      if (whereParts.length > 0) {
        queryText += ` WHERE ${whereParts.join(' AND ')}`;
      }
      
      queryText += ' ORDER BY render_created_at DESC';
      
      if (validLimit) {
        params.push(validLimit);
        queryText += ` LIMIT $${params.length}`;
      }
      
      // Execute using Neon pool for parameterized queries
      const result = await pool.query(queryText, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching render analytics:", error);
      res.status(500).json({ error: "Failed to fetch render analytics" });
    }
  });

  app.get('/api/admin/renders/analytics/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const queryText = 'SELECT * FROM render_analytics_v WHERE render_id = $1';
      const result = await pool.query(queryText, [req.params.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Render not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching render analytics:", error);
      res.status(500).json({ error: "Failed to fetch render analytics" });
    }
  });

  app.get('/api/admin/renders/:id/products', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const products = await curalinaStorage.getRenderProductsByRender(req.params.id);
      res.json(products);
    } catch (error) {
      console.error("Error fetching render products:", error);
      res.status(500).json({ error: "Failed to fetch render products" });
    }
  });

  app.get('/api/admin/renders/:id/events', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { eventType } = req.query;
      
      let events;
      if (eventType) {
        events = await curalinaStorage.getRenderEventsByType(req.params.id, eventType as string);
      } else {
        events = await curalinaStorage.getRenderEventsByRender(req.params.id);
      }
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching render events:", error);
      res.status(500).json({ error: "Failed to fetch render events" });
    }
  });

  // Cart endpoints
  app.get('/api/cart/:sessionId', async (req, res) => {
    try {
      const cart = await curalinaStorage.getCartBySession(req.params.sessionId);
      res.json(cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart', async (req, res) => {
    try {
      const validatedData = insertCartItemSchema.parse(req.body);
      const cartItem = await curalinaStorage.addToCart(validatedData);
      res.json(cartItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid cart item data", details: error.errors });
      }
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add to cart" });
    }
  });

  app.patch('/api/cart/:id', async (req, res) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== 'number' || quantity < 1) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      const cartItem = await curalinaStorage.updateCartItem(req.params.id, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ error: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/:id', async (req, res) => {
    try {
      await curalinaStorage.removeFromCart(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ error: "Failed to remove from cart" });
    }
  });

  // Order endpoints
  app.post('/api/orders', async (req, res) => {
    try {
      const { sessionId, customerEmail, customerName, shippingAddress } = req.body;

      if (!sessionId || !customerEmail || !customerName || !shippingAddress) {
        return res.status(400).json({ error: "Missing required order fields" });
      }

      // Get cart items
      const cartWithProducts = await curalinaStorage.getCartBySession(sessionId);
      if (cartWithProducts.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      // Calculate total
      const totalAmount = cartWithProducts.reduce((sum, item) => {
        const price = parseFloat(item.product.price);
        const discount = parseFloat(item.product.discount || "0");
        const finalPrice = price * (1 - discount / 100);
        return sum + (finalPrice * item.quantity);
      }, 0);

      // Validate with schema
      const orderData = insertOrderSchema.parse({
        sessionId,
        status: "pending",
        totalAmount: totalAmount.toFixed(2),
        customerEmail,
        customerName,
        shippingAddress,
      });

      const orderItemsData = cartWithProducts.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.product.price,
      }));

      const order = await curalinaStorage.createOrder(orderData, orderItemsData);

      // Clear cart
      await curalinaStorage.clearCart(sessionId);

      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    try {
      const order = await curalinaStorage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
      }

      const orders = await curalinaStorage.getOrdersBySession(sessionId as string);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Admin-only endpoints
  app.get('/api/admin/orders', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orders = await curalinaStorage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.patch('/api/admin/orders/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const order = await curalinaStorage.updateOrderStatus(req.params.id, req.body.status);
      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await curalinaStorage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await curalinaStorage.updateUserRole(req.params.id, req.body.role);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Admin ledger audit endpoint (Task 8: Full decision trail view)
  app.get('/api/admin/ledgers', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsedLimit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const limit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;
      const ledgers = await curalinaStorage.getAllLedgers(limit);
      res.json(ledgers);
    } catch (error) {
      console.error("Error fetching ledgers:", error);
      res.status(500).json({ error: "Failed to fetch ledgers" });
    }
  });

  app.get('/api/admin/renders', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const renders = await curalinaStorage.getAllRenders();
      res.json(renders);
    } catch (error) {
      console.error("Error fetching all renders:", error);
      res.status(500).json({ error: "Failed to fetch renders" });
    }
  });

  app.get('/api/admin/quiz-responses', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const quizResponses = await curalinaStorage.getAllQuizResponses();
      res.json(quizResponses);
    } catch (error) {
      console.error("Error fetching all quiz responses:", error);
      res.status(500).json({ error: "Failed to fetch quiz responses" });
    }
  });

  // Multi-angle analysis endpoint
  app.post('/api/admin/products/:id/analyze-multi-angle', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const productId = req.params.id;
      const multiAngleAnalyzer = await import('./services/multi-angle-analyzer');
      
      // Get product 
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Analyze this single product
      const result = await multiAngleAnalyzer.analyzeProductFromAllAngles(product, curalinaStorage);
      
      res.json({
        success: true,
        product: result,
        message: "Multi-angle analysis complete"
      });
    } catch (error) {
      console.error("Error analyzing product:", error);
      res.status(500).json({ error: "Failed to analyze product angles" });
    }
  });
  
  // Batch multi-angle analysis endpoint
  app.post('/api/admin/products/analyze-batch', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 10 } = req.body;
      const multiAngleAnalyzer = await import('./services/multi-angle-analyzer');
      
      // Run batch analysis
      const results = await multiAngleAnalyzer.batchAnalyzeProducts(curalinaStorage, limit);
      
      res.json({
        success: true,
        analyzed: results.analyzed,
        failed: results.failed,
        skipped: results.skipped,
        message: `Analyzed ${results.analyzed.length} products`
      });
    } catch (error) {
      console.error("Error in batch analysis:", error);
      res.status(500).json({ error: "Failed to run batch analysis" });
    }
  });

  // Background Upload Job endpoints
  // TRUE background upload - accepts files and processes them server-side
  app.post('/api/admin/upload-jobs/upload', isAuthenticated, isAdmin, upload.array('images', 200), async (req: any, res) => {
    try {
      const { productId } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId required" });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      // Validate product exists
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Create upload job and file records
      const { createUploadJob, processUploadJobBatch } = await import('./services/upload-job-service');
      
      const filesData = Array.from(req.files as any[]).map(file => ({
        fileName: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype,
      }));
      
      const job = await createUploadJob(productId, filesData, req.user?.id);
      
      // Start processing in background (non-blocking)
      setImmediate(async () => {
        try {
          let hasMore = true;
          while (hasMore) {
            hasMore = await processUploadJobBatch(job.id, filesData);
          }
        } catch (error) {
          console.error(`Background processing failed for job ${job.id}:`, error);
          await curalinaStorage.updateUploadJob(job.id, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Processing failed",
          });
        }
      });
      
      // Return immediately with job ID
      res.json({
        jobId: job.id,
        totalFiles: filesData.length,
        message: "Upload job started - processing in background",
      });
    } catch (error) {
      console.error("Error creating upload job:", error);
      res.status(500).json({ error: "Failed to create upload job" });
    }
  });

  app.post('/api/admin/upload-jobs/create', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { productId, fileList } = req.body;
      
      if (!productId || !Array.isArray(fileList) || fileList.length === 0) {
        return res.status(400).json({ error: "productId and non-empty fileList required" });
      }
      
      // Validate product exists
      const product = await curalinaStorage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Create upload job
      const job = await curalinaStorage.createUploadJob({
        productId,
        userId: req.user?.id,
        status: "pending",
        totalFiles: fileList.length,
        completedFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
      });
      
      // Create file records and generate presigned URLs
      const fileRecords = await Promise.all(
        fileList.map(async ({ filename, contentType, fileSize }: any) => {
          const s3Key = generateProductImageKey(product.sku, filename);
          
          // Check for duplicates
          const existsInS3 = await checkS3ObjectExists(s3Key);
          
          if (existsInS3) {
            const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
            const s3Url = `https://curalina.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
            
            return {
              fileRecord: {
                jobId: job.id,
                fileName: filename,
                fileSize,
                status: "skipped" as const,
                isDuplicate: true,
                s3Url,
              },
              presignedData: null,
            };
          }
          
          // Generate presigned URL for new files
          const presignedData = await generatePresignedUploadUrl(s3Key, contentType);
          const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
          
          return {
            fileRecord: {
              jobId: job.id,
              fileName: filename,
              fileSize,
              status: "pending" as const,
              isDuplicate: false,
            },
            presignedData: {
              ...presignedData,
              publicUrl: `https://curalina.s3.${AWS_REGION}.amazonaws.com/${s3Key}`,
              filename,
            },
          };
        })
      );
      
      // Save file records to database
      const fileRecordsToSave = fileRecords.map(r => r.fileRecord);
      await curalinaStorage.createUploadJobFiles(fileRecordsToSave);
      
      // Update job with skipped count
      const skippedCount = fileRecords.filter(r => r.fileRecord.isDuplicate).length;
      if (skippedCount > 0) {
        await curalinaStorage.updateUploadJob(job.id, { skippedFiles: skippedCount });
      }
      
      // Return job ID and presigned URLs for files that need uploading
      const uploadsNeeded = fileRecords
        .filter(r => r.presignedData !== null)
        .map(r => r.presignedData);
      
      res.json({
        jobId: job.id,
        uploadsNeeded,
        skippedCount,
        totalFiles: fileList.length,
      });
    } catch (error) {
      console.error("Error creating upload job:", error);
      res.status(500).json({ error: "Failed to create upload job" });
    }
  });

  // Confirm file upload completion
  app.post('/api/admin/upload-jobs/:jobId/confirm/:filename', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { jobId, filename } = req.params;
      const { s3Url, success, error } = req.body;
      
      // Find the file record
      const files = await curalinaStorage.getUploadJobFiles(jobId);
      const fileRecord = files.find(f => f.fileName === filename);
      
      if (!fileRecord) {
        return res.status(404).json({ error: "File record not found" });
      }
      
      // Update file status
      if (success) {
        await curalinaStorage.updateUploadJobFile(fileRecord.id, {
          status: "completed",
          s3Url,
          uploadedAt: new Date(),
        });
        
        // Update job completed count
        const job = await curalinaStorage.getUploadJob(jobId);
        if (job) {
          await curalinaStorage.updateUploadJob(jobId, {
            completedFiles: job.completedFiles + 1,
          });
          
          // Check if job is complete
          const totalProcessed = job.completedFiles + 1 + job.failedFiles + job.skippedFiles;
          if (totalProcessed >= job.totalFiles) {
            // Update product images
            const allFiles = await curalinaStorage.getUploadJobFiles(jobId);
            const successfulUploads = allFiles
              .filter(f => f.status === "completed" && f.s3Url)
              .map(f => f.s3Url!);
            
            if (successfulUploads.length > 0) {
              const product = await curalinaStorage.getProduct(job.productId);
              if (product) {
                const existingImages = product.images || [];
                const newImages = [...existingImages, ...successfulUploads];
                await curalinaStorage.updateProduct(job.productId, { images: newImages });
              }
            }
            
            await curalinaStorage.updateUploadJob(jobId, {
              status: job.failedFiles > 0 ? "failed" : "completed",
              completedAt: new Date(),
            });
          }
        }
      } else {
        await curalinaStorage.updateUploadJobFile(fileRecord.id, {
          status: "failed",
          errorMessage: error || "Upload failed",
        });
        
        // Update job failed count
        const job = await curalinaStorage.getUploadJob(jobId);
        if (job) {
          await curalinaStorage.updateUploadJob(jobId, {
            failedFiles: job.failedFiles + 1,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error confirming upload:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  app.get('/api/admin/upload-jobs/active', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const jobs = await curalinaStorage.getActiveUploadJobs(userId);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching active upload jobs:", error);
      res.status(500).json({ error: "Failed to fetch active upload jobs" });
    }
  });

  app.get('/api/admin/upload-jobs/:id/status', async (req: any, res) => {
    try {
      const { getJobStatus } = await import('./services/upload-job-service');
      const status = await getJobStatus(req.params.id);
      
      if (!status) {
        return res.status(404).json({ error: "Upload job not found" });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching upload job status:", error);
      res.status(500).json({ error: "Failed to fetch upload job status" });
    }
  });

  // Documentation System endpoints
  // Documentation Sections - Admin and client access
  app.get('/api/documentation/sections', isAuthenticated, async (req: any, res) => {
    try {
      const { status, slug } = req.query;
      const filters: any = {};
      
      // Non-admin users only see published sections
      if (req.user?.role !== 'admin') {
        filters.status = 'published';
      } else if (status) {
        filters.status = status as string;
      }
      
      if (slug) {
        filters.slug = slug as string;
      }
      
      const sections = await curalinaStorage.getAllDocumentationSections(filters);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching documentation sections:", error);
      res.status(500).json({ error: "Failed to fetch documentation sections" });
    }
  });

  app.get('/api/documentation/sections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const section = await curalinaStorage.getDocumentationSection(req.params.id);
      
      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }
      
      // Non-admin users can only see published sections
      if (req.user?.role !== 'admin' && section.status !== 'published') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(section);
    } catch (error) {
      console.error("Error fetching documentation section:", error);
      res.status(500).json({ error: "Failed to fetch documentation section" });
    }
  });

  app.get('/api/documentation/sections/slug/:slug', isAuthenticated, async (req: any, res) => {
    try {
      const version = req.query.version ? parseInt(req.query.version as string) : undefined;
      const section = await curalinaStorage.getDocumentationSectionBySlug(req.params.slug, version);
      
      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }
      
      // Non-admin users can only see published sections
      if (req.user?.role !== 'admin' && section.status !== 'published') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(section);
    } catch (error) {
      console.error("Error fetching documentation section by slug:", error);
      res.status(500).json({ error: "Failed to fetch documentation section" });
    }
  });

  app.post('/api/admin/documentation/sections', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertDocumentationSectionSchema.parse({
        ...req.body,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });
      
      const section = await curalinaStorage.createDocumentationSection(validatedData);
      res.json(section);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid section data", details: error.errors });
      }
      console.error("Error creating documentation section:", error);
      res.status(500).json({ error: "Failed to create documentation section" });
    }
  });

  app.patch('/api/admin/documentation/sections/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
      };
      
      const section = await curalinaStorage.updateDocumentationSection(req.params.id, updateData);
      res.json(section);
    } catch (error) {
      console.error("Error updating documentation section:", error);
      res.status(500).json({ error: "Failed to update documentation section" });
    }
  });

  app.delete('/api/admin/documentation/sections/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await curalinaStorage.deleteDocumentationSection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting documentation section:", error);
      res.status(500).json({ error: "Failed to delete documentation section" });
    }
  });

  app.post('/api/admin/documentation/sections/:id/publish', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const section = await curalinaStorage.publishDocumentationSection(req.params.id);
      res.json(section);
    } catch (error) {
      console.error("Error publishing documentation section:", error);
      res.status(500).json({ error: "Failed to publish documentation section" });
    }
  });

  // Documentation Comments - Admin and client access
  app.get('/api/documentation/sections/:sectionId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const { resolved, isInternal } = req.query;
      const filters: any = {};
      
      if (resolved !== undefined) {
        filters.resolved = resolved === 'true';
      }
      
      // Non-admin users can't see internal comments
      if (req.user?.role !== 'admin') {
        filters.isInternal = false;
      } else if (isInternal !== undefined) {
        filters.isInternal = isInternal === 'true';
      }
      
      const comments = await curalinaStorage.getCommentsBySection(req.params.sectionId, filters);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post('/api/documentation/comments', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertDocumentationCommentSchema.parse({
        ...req.body,
        userId: req.user.id,
        // Only admins can create internal comments
        isInternal: req.user.role === 'admin' ? req.body.isInternal : false,
      });
      
      const comment = await curalinaStorage.createComment(validatedData);
      res.json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid comment data", details: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.patch('/api/documentation/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const comment = await curalinaStorage.getComment(req.params.id);
      
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Users can only edit their own comments, unless admin
      if (comment.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await curalinaStorage.updateComment(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.delete('/api/documentation/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const comment = await curalinaStorage.getComment(req.params.id);
      
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Users can only delete their own comments, unless admin
      if (comment.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await curalinaStorage.deleteComment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.post('/api/documentation/comments/:id/resolve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const comment = await curalinaStorage.resolveComment(req.params.id, req.user.id);
      res.json(comment);
    } catch (error) {
      console.error("Error resolving comment:", error);
      res.status(500).json({ error: "Failed to resolve comment" });
    }
  });

  // COMPREHENSIVE ANALYSIS ENDPOINTS
  // Analyze ALL products with one trigger
  app.post('/api/admin/products/analyze-all-comprehensive', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('\n🎨 ANALYZING ALL PRODUCTS - COMPREHENSIVE APPROACH');
      
      const allProducts = await curalinaStorage.getAllProducts();
      const productsWithImages = allProducts.filter(p => p.images && p.images.length > 0);
      
      console.log(`📊 Found ${productsWithImages.length}/${allProducts.length} products with images`);
      
      if (productsWithImages.length === 0) {
        return res.json({
          success: true,
          totalProducts: 0,
          message: 'No products with images found',
          analyzed: 0
        });
      }
      
      const { analyzeProductComprehensively } = await import('./services/comprehensive-visual-analyzer');
      const { EnhancedQualityScorer } = await import('./services/enhanced-quality-scorer');
      
      // Start background analysis of ALL products
      const results = [];
      (async () => {
        console.log(`🚀 Starting analysis of ${productsWithImages.length} products...`);
        
        for (let i = 0; i < productsWithImages.length; i++) {
          const product = productsWithImages[i];
          try {
            console.log(`\n[${i+1}/${productsWithImages.length}] 📸 ${product.name} (${product.sku})`);
            
            const analysis = await analyzeProductComprehensively(product.name, product.images);
            if (!analysis) {
              console.warn(`  ❌ No valid images`);
              continue;
            }
            
            const metrics = EnhancedQualityScorer.calculateMetrics(analysis.frontViewAnalysis);
            
            const structuredData = {
              frontView: analysis.frontViewAnalysis,
              multiAngle: analysis.synthesizedAnalysis,
              analysisDate: new Date().toISOString(),
              geminiVersion: 'gemini-2.5-flash'
            };
            
            await curalinaStorage.updateProductStructuredAnalysis(
              product.id,
              structuredData,
              metrics.overallScore
            );
            
            console.log(`  ✅ Score: ${metrics.overallScore}/100 | ${metrics.regenerationReadiness}`);
            
            results.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              score: metrics.overallScore,
              readiness: metrics.regenerationReadiness
            });
          } catch (error) {
            console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown');
            results.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        const successful = results.filter(r => !r.error).length;
        console.log(`\n✅ ANALYSIS COMPLETE: ${successful}/${productsWithImages.length} products analyzed`);
        console.log(`📊 Ready: ${results.filter(r => r.readiness === 'ready').length} | Caution: ${results.filter(r => r.readiness === 'caution').length} | Needs Work: ${results.filter(r => r.readiness === 'needs_work').length}`);
      })();
      
      res.json({
        success: true,
        totalProducts: productsWithImages.length,
        message: `Comprehensive analysis started for all ${productsWithImages.length} products. Check server logs for real-time progress.`,
        version: 'comprehensive-v3'
      });
      
    } catch (error) {
      console.error("Error analyzing all products:", error);
      res.status(500).json({ error: "Failed to start analysis", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  // Trigger comprehensive analysis for a single product
  app.post('/api/admin/products/:id/analyze-comprehensive', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const product = await curalinaStorage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const { analyzeProductComprehensively } = await import("./services/comprehensive-visual-analyzer");
      const { EnhancedQualityScorer } = await import("./services/enhanced-quality-scorer");

      console.log(`\n📸 Starting comprehensive analysis for: ${product.name}`);
      
      const result = await analyzeProductComprehensively(product.name, product.images);
      
      if (!result) {
        return res.status(400).json({ error: "No valid images found for analysis" });
      }

      // Calculate detailed quality metrics
      const metrics = EnhancedQualityScorer.calculateMetrics(result.frontViewAnalysis);

      // Save to database
      const structuredData = {
        frontView: result.frontViewAnalysis,
        multiAngle: result.synthesizedAnalysis,
        analysisDate: new Date().toISOString(),
        geminiVersion: 'gemini-2.5-flash'
      };

      await curalinaStorage.updateProductStructuredAnalysis(
        req.params.id,
        structuredData,
        metrics.overallScore
      );

      res.json({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku
        },
        analysis: {
          frontView: result.frontViewAnalysis,
          synthesized: result.synthesizedAnalysis,
          metrics,
          imageCount: result.multiAngleAnalyses.length
        }
      });
    } catch (error) {
      console.error("Error in comprehensive analysis:", error);
      res.status(500).json({ error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Trigger analysis for all products needing it
  app.post('/api/admin/products/analyze-batch', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit = 10, minScore = 60 } = req.body;

      const productsToAnalyze = await curalinaStorage.getProductsNeedingAnalysis(limit);

      if (productsToAnalyze.length === 0) {
        return res.json({ 
          message: "No products need analysis", 
          analyzed: 0 
        });
      }

      console.log(`\n📸 Starting batch analysis for ${productsToAnalyze.length} products`);

      const { analyzeProductComprehensively } = await import("./services/comprehensive-visual-analyzer");
      const { EnhancedQualityScorer } = await import("./services/enhanced-quality-scorer");

      const results = [];

      for (const product of productsToAnalyze) {
        try {
          const analysis = await analyzeProductComprehensively(product.name, product.images);
          
          if (analysis) {
            const metrics = EnhancedQualityScorer.calculateMetrics(analysis.frontViewAnalysis);
            
            const structuredData = {
              frontView: analysis.frontViewAnalysis,
              multiAngle: analysis.synthesizedAnalysis,
              analysisDate: new Date().toISOString(),
              geminiVersion: 'gemini-2.5-flash'
            };

            await curalinaStorage.updateProductStructuredAnalysis(
              product.id,
              structuredData,
              metrics.overallScore
            );

            results.push({
              id: product.id,
              sku: product.sku,
              name: product.name,
              score: metrics.overallScore,
              readiness: metrics.regenerationReadiness
            });
          }
        } catch (error) {
          console.error(`Failed to analyze ${product.sku}:`, error);
          results.push({
            id: product.id,
            sku: product.sku,
            name: product.name,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      res.json({
        analyzed: results.length,
        results
      });
    } catch (error) {
      console.error("Error in batch analysis:", error);
      res.status(500).json({ error: "Batch analysis failed", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get products by quality score range
  app.get('/api/admin/products/quality/:minScore/:maxScore', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const minScore = parseInt(req.params.minScore) || 0;
      const maxScore = parseInt(req.params.maxScore) || 100;

      const products = await curalinaStorage.getProductsByQualityScore(minScore, maxScore);
      
      res.json({
        count: products.length,
        minScore,
        maxScore,
        products: products.map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          score: p.structuredAnalysisQuality,
          analyzedAt: p.structuredAnalysisUpdatedAt
        }))
      });
    } catch (error) {
      console.error("Error fetching products by quality:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get detailed analysis for a product
  app.get('/api/admin/products/:id/analysis', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const product = await curalinaStorage.getProduct(req.params.id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (!product.structuredAnalysis) {
        return res.status(404).json({ error: "No analysis available for this product" });
      }

      const { EnhancedQualityScorer } = await import("./services/enhanced-quality-scorer");
      
      const frontView = (product.structuredAnalysis as any).frontView;
      const metrics = frontView ? EnhancedQualityScorer.calculateMetrics(frontView) : null;
      const report = frontView ? EnhancedQualityScorer.generateReport(frontView) : 'No analysis data';

      res.json({
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          images: product.images
        },
        analysis: product.structuredAnalysis,
        metrics,
        qualityScore: product.structuredAnalysisQuality,
        analyzedAt: product.structuredAnalysisUpdatedAt,
        report
      });
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Bulk delete products
  app.delete('/api/admin/products/bulk-delete', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { productIds, deleteAll } = req.body;
      
      if (deleteAll) {
        const allProducts = await curalinaStorage.getAllProducts();
        for (const product of allProducts) {
          try {
            await curalinaStorage.deleteProduct(product.id);
          } catch (e) {
            console.error(`Failed to delete product ${product.id}:`, e);
          }
        }
        return res.json({ success: true, deletedCount: allProducts.length });
      }
      
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds array required" });
      }
      
      let deletedCount = 0;
      for (const id of productIds) {
        try {
          await curalinaStorage.deleteProduct(id);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete product ${id}:`, e);
        }
      }
      
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error bulk deleting products:", error);
      res.status(500).json({ error: "Failed to delete products" });
    }
  });

  // Export all products as CSV
  app.get('/api/admin/products/export/all', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const products = await curalinaStorage.getAllProducts();
      
      const headers = [
        'SKU', 'Name', 'Price', 'Trade Price', 'Category', 'Supplier', 'Images',
        'Availability', 'Description', 'Visual Description', 'Dimensions', 'Colors'
      ];
      
      const rows = products.map(p => [
        p.sku,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.price || '',
        p.tradePrice || '',
        p.categoryId || '',
        p.supplierId || '',
        (p.images || []).length,
        p.availability || 'unknown',
        `"${(p.description || '').replace(/"/g, '""')}"`,
        `"${((p as any).visualDescription || '').substring(0, 100).replace(/"/g, '""')}"`,
        p.dimensions ? JSON.stringify(p.dimensions) : '',
        (p.colors || []).join('; ')
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting products:", error);
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // Export filtered products as CSV
  app.post('/api/admin/products/export/filtered', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { searchQuery, categoryId, supplierId, minPrice, maxPrice, hasImages } = req.body;
      let products = await curalinaStorage.getAllProducts();
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        products = products.filter(p => 
          p.sku.toLowerCase().includes(q) || 
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }
      
      if (categoryId && categoryId !== 'all') {
        products = products.filter(p => p.categoryId === categoryId);
      }
      
      if (supplierId && supplierId !== 'all') {
        products = products.filter(p => p.supplierId === supplierId);
      }
      
      if (minPrice) {
        const min = parseFloat(minPrice);
        products = products.filter(p => parseFloat(p.price || '0') >= min);
      }
      
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        products = products.filter(p => parseFloat(p.price || '0') <= max);
      }
      
      if (hasImages === 'true') {
        products = products.filter(p => p.images && p.images.length > 0);
      } else if (hasImages === 'false') {
        products = products.filter(p => !p.images || p.images.length === 0);
      }
      
      const headers = [
        'SKU', 'Name', 'Price', 'Trade Price', 'Category', 'Supplier', 'Images',
        'Availability', 'Description', 'Visual Description', 'Dimensions', 'Colors'
      ];
      
      const rows = products.map(p => [
        p.sku,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.price || '',
        p.tradePrice || '',
        p.categoryId || '',
        p.supplierId || '',
        (p.images || []).length,
        p.availability || 'unknown',
        `"${(p.description || '').replace(/"/g, '""')}"`,
        `"${((p as any).visualDescription || '').substring(0, 100).replace(/"/g, '""')}"`,
        p.dimensions ? JSON.stringify(p.dimensions) : '',
        (p.colors || []).join('; ')
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products-filtered.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting filtered products:", error);
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // Get S3 configuration
  app.get('/api/admin/settings/s3', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const bucketSetting = await curalinaStorage.getSettings?.('s3_bucket_name') || 
        { key: 's3_bucket_name', value: process.env.S3_BUCKET || 'curalina', description: 'S3 bucket name' };
      const prefixSetting = await curalinaStorage.getSettings?.('s3_folder_prefix') || 
        { key: 's3_folder_prefix', value: 'products', description: 'S3 folder prefix' };
      
      res.json({
        bucketName: bucketSetting?.value || process.env.S3_BUCKET || 'curalina',
        folderPrefix: prefixSetting?.value || 'products'
      });
    } catch (error) {
      console.error("Error fetching S3 settings:", error);
      res.status(500).json({ error: "Failed to fetch S3 settings" });
    }
  });

  // Update S3 configuration
  app.put('/api/admin/settings/s3', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { bucketName, folderPrefix } = req.body;
      
      if (!bucketName || !folderPrefix) {
        return res.status(400).json({ error: "bucketName and folderPrefix are required" });
      }
      
      // TODO: Save to database when storage has settings support
      // For now just return the values
      res.json({ 
        success: true, 
        bucketName, 
        folderPrefix,
        message: "S3 configuration updated (in-memory - restart required for persistence)"
      });
    } catch (error) {
      console.error("Error updating S3 settings:", error);
      res.status(500).json({ error: "Failed to update S3 settings" });
    }
  });
}
