import type { Express } from "express";
import multer from "multer";
import { curalinaStorage } from "./storage-curalina";
import { ObjectStorageService } from "./objectStorage";
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
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated } from "./localAuth";
import { isAdmin } from "./routes";
import { buildPromptFromQuiz, generateInteriorImage, extractProductSkus } from "./services/gemini-ai";
import { uploadToS3, generateProductImageKey } from "./s3";

const upload = multer({ storage: multer.memoryStorage() });
const objectStorageService = new ObjectStorageService();

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

  // Upload product image to S3
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
          
          if (existingProduct) {
            skipped++;
            continue;
          }

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

          // Parse dimensions from format "20.5" W X 18.5" D X 22.7" H"
          let dimensions = null;
          const dimString = row['General Dimensions (Inch)\r\nWidth x Depth x Height'] || row['General Dimensions (Inch)'];
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
          const leadTimeValue = row['LEAD Time'] ? (parseInt(row['LEAD Time']) || null) : null;

          // Insert product
          const productName = row['Product Name'] || 'Unknown Product';
          await curalinaStorage.createProduct({
            sku,
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
            weight: row['Weight (lbs) '] || row['Weight (lbs)'] || null,
            assembly: row.Assembly || null,
            inventory: inventoryValue,
            leadTime: leadTimeValue,
            availability: (inventoryValue && inventoryValue > 0) ? 'in_stock' : 'preorder',
            images: [],
            asset3dUrl: null,
            tags: tagsArray,
            sourceFile: row['Source File'] || null,
            shipping: { cost: 0, eta: leadTimeValue ? `${leadTimeValue} days` : '5-7 business days' },
            seoMeta: { 
              title: productName, 
              description: row.Overview ? row.Overview.substring(0, 160) : '' 
            },
            slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          });

          imported++;
        } catch (error) {
          console.error(`Error importing row:`, error);
          errors.push(`Row ${imported + skipped + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        errors,
        details: `Processed ${data.length} rows. Imported ${imported} products, skipped ${skipped} duplicates.`
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

  // Public asset serving endpoint
  app.get('/public-objects/:filePath(*)', async (req, res) => {
    try {
      const filePath = req.params.filePath;
      const file = await objectStorageService.searchPublicObject(filePath);
      
      if (!file) {
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
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
        
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
        
        const publicUrl = `/public-objects/${folder}/${fileName}`;
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
      const quiz = await curalinaStorage.createQuizResponse(validatedData);
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

      // Create render record with status 'generating' (placeholder prompt)
      const render = await curalinaStorage.createRender({
        ...renderData,
        sessionId: quiz.sessionId,
        prompt: "Generating...",
      });

      // Return immediately with status 'generating'
      res.json(render);

      // Start async AI generation process
      (async () => {
        try {
          console.log(`🎨 Starting AI render for ${quiz.roomType} in ${quiz.style} style`);
          
          // Step 1: Get all products
          const allProducts = await curalinaStorage.getAllProducts();
          console.log(`Found ${allProducts.length} total products`);
          
          // Step 2: Check if specific products were requested (for regeneration with swaps)
          const { filterProductsByQuiz, selectProductsWithAI, buildPromptFromQuiz } = await import('./services/gemini-ai');
          let selectedProducts: Array<{ sku: string; name: string; placement: string; reasoning: string }> = [];
          
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
              selectedProducts = await selectProductsWithAI(filteredProducts, quiz);
              console.log(`AI selected ${selectedProducts.length} products for the room`);
            } else {
              console.warn("No matching products found, generating room without specific products");
            }
          }
          
          // Step 4: Build enhanced prompt with selected products
          const prompt = buildPromptFromQuiz(quiz, selectedProducts);
          
          // Generate image with Gemini AI
          let floorplanUrl: string | undefined = undefined;
          if (quiz.floorplanUrl) {
            const domain = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
            // Ensure domain has protocol
            const fullDomain = domain.startsWith('http') ? domain : `https://${domain}`;
            floorplanUrl = `${fullDomain}${quiz.floorplanUrl}`;
          }
          
          const imageDataUrl = await generateInteriorImage(prompt, floorplanUrl);
          
          // Extract base64 data from data URL (format: data:image/png;base64,...)
          const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
          if (!base64Match) {
            throw new Error("Invalid image data format");
          }
          const base64Data = base64Match[1];
          
          // Save generated image to object storage
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
          
          // Store selected product SKUs
          const productSkus = selectedProducts.map(p => p.sku);
          
          // Update render with completed data
          await curalinaStorage.updateRender(render.id, {
            imageUrl,
            productSkus,
            prompt,
            status: 'completed',
          });
          
          console.log(`✅ Render ${render.id} completed with ${productSkus.length} products`);
        } catch (error) {
          console.error("AI generation error:", error);
          
          // Update render with failed status
          await curalinaStorage.updateRender(render.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
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
}
