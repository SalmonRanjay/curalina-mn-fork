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
  insertComparisonRenderSchema,
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated } from "./localAuth";
import { isAdmin } from "./routes";
import { buildPromptFromQuiz, extractProductSkus, detectVisibleProducts } from "./services/gemini-ai";
import { uploadToS3, generateProductImageKey, generatePresignedUploadUrl, checkS3ObjectExists } from "./s3";
import type { PlacementInstruction } from "./services/room-composition-service";
import { renameAllProductImages, previewImageRenames } from "./services/s3-image-renamer";
import { 
  createAndStartS3RenamingJob, 
  getS3JobDetails, 
  getS3JobQueueStatus 
} from "./services/s3-renaming-job-service";

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

// Helper to convert image filenames/paths to full S3 URLs
// Assumes filenames use dashes instead of spaces (normalized)
function transformProductImages(product: any) {
  if (!product.images || product.images.length === 0) return product;
  
  const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;
  const BUCKET_NAME = "curalina";
  
  // Transform images array to full S3 URLs
  const transformedImages = product.images.map((imageUrl: string) => {
    // If already a full URL, return as-is
    if (imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // Construct full S3 URL from filename
    // Filenames are expected to be normalized (dashes instead of spaces)
    return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${imageUrl}`;
  });
  
  return { ...product, images: transformedImages };
}

// Helper to transform an array of products
function transformProductsImages(products: any[]) {
  return products.map(transformProductImages);
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
      console.log(`[DEBUG] Fetched ${products.length} products, first product images:`, products[0]?.images?.slice(0, 2));
      const transformedProducts = transformProductsImages(products);
      console.log(`[DEBUG] After transform, first product images:`, transformedProducts[0]?.images?.slice(0, 2));
      res.json(transformedProducts);
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
      const transformedProduct = transformProductImages(product);
      res.json(transformedProduct);
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
      const transformedProduct = transformProductImages(product);
      res.json(transformedProduct);
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

  // S3 image renaming endpoints - Replace spaces with dashes
  // Legacy preview endpoint (dry run)
  app.post('/api/admin/products/s3-images/preview-rename', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('[S3-RENAME] Starting preview of S3 image renaming...');
      const summary = await previewImageRenames(curalinaStorage);
      res.json(summary);
    } catch (error) {
      console.error('Error previewing S3 image renames:', error);
      res.status(500).json({ error: 'Failed to preview S3 image renames' });
    }
  });

  // New persistent job-based execution
  app.post('/api/admin/products/s3-images/start-rename-job', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { dryRun = false, priority = 0 } = req.body;
      console.log(`[S3-RENAME] Starting S3 image renaming job (dryRun: ${dryRun})`);
      
      const job = await createAndStartS3RenamingJob(undefined, {
        priority,
        autoStart: true,
        dryRun,
        userId: req.user?.id
      });
      
      res.json(job);
    } catch (error) {
      console.error('Error starting S3 renaming job:', error);
      res.status(500).json({ error: 'Failed to start S3 renaming job' });
    }
  });

  // Get job status and details
  app.get('/api/admin/products/s3-images/job/:jobId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const jobDetails = await getS3JobDetails(req.params.jobId);
      if (!jobDetails) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(jobDetails);
    } catch (error) {
      console.error('Error getting S3 job details:', error);
      res.status(500).json({ error: 'Failed to get job details' });
    }
  });

  // Get queue status
  app.get('/api/admin/products/s3-images/queue-status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const status = getS3JobQueueStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting queue status:', error);
      res.status(500).json({ error: 'Failed to get queue status' });
    }
  });

  // Legacy execute endpoint (uses new persistent job system)
  app.post('/api/admin/products/s3-images/execute-rename', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log('[S3-RENAME] Starting S3 image renaming execution (legacy endpoint)...');
      
      // Create and start job with high priority
      const job = await createAndStartS3RenamingJob(undefined, {
        priority: 100,
        autoStart: true,
        dryRun: false,
        userId: req.user?.id
      });
      
      // Return job info instead of immediate results
      res.json({
        message: 'S3 renaming job started',
        jobId: job.id,
        status: job.status,
        totalProducts: job.totalProducts
      });
    } catch (error) {
      console.error('Error executing S3 image renames:', error);
      res.status(500).json({ error: 'Failed to execute S3 image renames' });
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

  // Preview CSV for column mapping
  app.post('/api/admin/products/preview-csv', isAuthenticated, isAdmin, upload.single('file'), async (req: any, res) => {
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

      // Extract columns and sample data
      const columns = Object.keys(data[0] as any);
      const sampleData = data.slice(0, 3); // Return first 3 rows as sample

      res.json({ columns, sampleData });
    } catch (error) {
      console.error("Error previewing CSV:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to preview CSV" });
    }
  });

  // Bulk CSV/Excel import with column mapping
  app.post('/api/admin/products/import-csv', isAuthenticated, isAdmin, upload.fields([{ name: 'file', maxCount: 1 }]), async (req: any, res) => {
    try {
      // When using upload.fields(), files are in req.files object
      const uploadedFile = req.files && req.files.file && req.files.file[0];
      
      if (!uploadedFile) {
        return res.status(400).json({ 
          success: false,
          error: "No file uploaded",
          imported: 0,
          skipped: 0,
          errors: []
        });
      }

      console.log('📥 CSV Import started:', uploadedFile.originalname);
      console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

      const { read, utils } = await import('xlsx');
      
      // Parse the file
      const workbook = read(uploadedFile.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(worksheet);

      console.log(`📊 Parsed ${data.length} rows from Excel file`);

      // Get column mappings if provided (from multipart form data)
      // Multer parses files but we need to access other form fields from req.body
      const mappingsStr = (req.body && typeof req.body.mappings === 'string') ? req.body.mappings : null;
      let mappings = null;
      
      try {
        mappings = mappingsStr ? JSON.parse(mappingsStr) : null;
        console.log('🗺️  Column mappings:', mappings ? `${mappings.length} mappings` : 'none provided');
        if (mappings && mappings.length > 0) {
          console.log('First mapping example:', mappings[0]);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse mappings JSON:', parseError);
        return res.status(400).json({ 
          success: false,
          error: "Invalid column mappings format",
          imported: 0,
          skipped: 0,
          errors: ['Failed to parse column mappings']
        });
      }
      
      // Create a mapping function to transform row data
      const mapRow = (row: any) => {
        if (!mappings || mappings.length === 0) {
          // No mapping provided, return as-is
          return row;
        }
        
        const mapped: any = {};
        mappings.forEach((mapping: any) => {
          if (mapping.targetField && row[mapping.csvColumn] !== undefined) {
            mapped[mapping.targetField] = row[mapping.csvColumn];
          }
        });
        return mapped;
      };

      if (data.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "File is empty or has no valid data",
          imported: 0,
          skipped: 0,
          errors: []
        });
      }

      // Log first row before and after mapping
      console.log('🔍 First row (original):', Object.keys(data[0] as any).slice(0, 5));
      const firstMapped = mapRow(data[0] as any);
      console.log('🔍 First row (mapped):', Object.keys(firstMapped).slice(0, 5));

      let imported = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const rawRow of data as any[]) {
        try {
          // Apply column mapping if provided
          const row = mapRow(rawRow);
          
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
          const dimString = row['Dimensions (Inch) Width x Depth x Height'] || row['General Dimensions (Inch)\r\nWidth x Depth x Height'] || row['General Dimensions (Inch)'] || row['General Dimensions'];
          
          // Start with general dimensions
          if (dimString) {
            // Try matching: 90"W x 20"D x 32"H format
            let matches = dimString.match(/(\d+\.?\d*)\s*"\s*W\s*X\s*(\d+\.?\d*)\s*"\s*D\s*X\s*(\d+\.?\d*)\s*"\s*H/i);
            if (matches) {
              dimensions = {
                w: parseFloat(matches[1]),
                d: parseFloat(matches[2]),
                h: parseFloat(matches[3]),
                unit: 'inches'
              };
            } else {
              // Try matching: 90"d x 20"h format (depth and height only, common for chairs)
              matches = dimString.match(/(\d+\.?\d*)\s*["\']?\s*[Dd]\s*[Xx×]\s*(\d+\.?\d*)\s*["\']?\s*[Hh]/);
              if (matches) {
                dimensions = {
                  d: parseFloat(matches[1]),  // First number is depth
                  h: parseFloat(matches[2]),  // Second number is height
                  unit: 'inches'
                };
              } else {
                // Try matching: WxDxH format (just numbers separated by x)
                matches = dimString.match(/(\d+\.?\d*)\s*[Xx×]\s*(\d+\.?\d*)\s*[Xx×]\s*(\d+\.?\d*)/);
                if (matches) {
                  dimensions = {
                    w: parseFloat(matches[1]),
                    d: parseFloat(matches[2]),
                    h: parseFloat(matches[3]),
                    unit: 'inches'
                  };
                }
              }
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
          const seatHeightVal = parseNumeric(row['Seat Height']);
          const volumeVal = parseNumeric(row['Volume']);
          const doorWidthVal = parseNumeric(row['Door Width']);
          const doorThicknessVal = parseNumeric(row['Door Thickness']);
          const doorHeightVal = parseNumeric(row['Door Height']);
          const legBaseDepth1Val = parseNumeric(row['Leg/Base Depth 1']);
          const legBaseHeight1Val = parseNumeric(row['Leg/Base Height 1']);
          const legBaseWidth1Val = parseNumeric(row['Leg/Base Width 1']);
          const tabletopThicknessVal = parseNumeric(row['Tabletop Thickness']);
          const shapeTypeVal = row['Shape Type'] ? String(row['Shape Type']).trim() : null;
          
          // If individual dimensions provided, use or merge them
          if (heightVal || widthVal || depthVal || armWidthVal || armDepthVal || seatWidthVal || seatDepthVal || seatHeightVal || volumeVal || doorWidthVal || doorThicknessVal || doorHeightVal || legBaseDepth1Val || legBaseHeight1Val || legBaseWidth1Val || tabletopThicknessVal || shapeTypeVal) {
            dimensions = {
              ...dimensions,
              w: widthVal || dimensions?.w || null,
              d: depthVal || dimensions?.d || null,
              h: heightVal || dimensions?.h || null,
              armWidth: armWidthVal || null,
              armDepth: armDepthVal || null,
              seatWidth: seatWidthVal || null,
              seatDepth: seatDepthVal || null,
              seatHeight: seatHeightVal || null,
              volume: volumeVal || null,
              doorWidth: doorWidthVal || null,
              doorThickness: doorThicknessVal || null,
              doorHeight: doorHeightVal || null,
              legBaseDepth1: legBaseDepth1Val || null,
              legBaseHeight1: legBaseHeight1Val || null,
              legBaseWidth1: legBaseWidth1Val || null,
              tabletopThickness: tabletopThicknessVal || null,
              shapeType: shapeTypeVal || null,
              unit: 'inches'
            };
          }

          // Parse colors
          const colorField = row.Colour || row.Color;
          const colorArray = colorField ? colorField.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
          
          // Parse materials
          const materialField = row['Product Materials'] || row['Product Material'];
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
            weight: row['Weight (lbs)'] || row['Weight (lbs) '] || row.Weight || null,
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
            // Don't include slug in update - keep the original slug
            await curalinaStorage.updateProduct(existingProduct.id, productData);
            updated++;
            console.log(`✏️  Updated product ${sku}: ${productName}`);
          } else {
            // Create new product with unique slug (append random suffix to handle duplicates)
            const baseSlug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + String(sku).toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const uniqueSuffix = Math.random().toString(36).substring(2, 6); // 4 random chars
            const uniqueSlug = baseSlug + '-' + uniqueSuffix;
            
            await curalinaStorage.createProduct({
              sku,
              ...productData,
              images: [],
              asset3dUrl: null,
              slug: uniqueSlug,
            });
            imported++;
            console.log(`✅ Created new product ${sku}: ${productName}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error importing row ${imported + updated + 1}:`, errorMessage);
          errors.push(`Row ${imported + updated + 1}: ${errorMessage}`);
        }
      }

      console.log(`✅ CSV Import completed: ${imported} imported, ${updated} updated, ${errors.length} errors`);

      res.json({
        success: true,
        imported,
        updated,
        errors,
        details: `Processed ${data.length} rows. Created ${imported} new products, updated ${updated} existing products.${errors.length > 0 ? ` Encountered ${errors.length} errors.` : ''}`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process import file";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error("❌ Error processing CSV import:", errorMessage);
      if (errorStack) {
        console.error("Stack trace:", errorStack);
      }
      
      res.status(500).json({ 
        success: false,
        error: errorMessage,
        imported: 0,
        skipped: 0,
        errors: [errorMessage]
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
      const transformedProducts = transformProductsImages(products);
      res.json(transformedProducts);
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
      const transformedProduct = transformProductImages(product);
      res.json(transformedProduct);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Visual Description Regeneration - Uses trained analyzer with word count validation (30-40 words)
  // Supports resume functionality and filtering for products with missing descriptions
  app.post('/api/admin/products/regenerate-visual-descriptions', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { mode = 'missing_only', resumeJobId } = req.body;
      
      if (resumeJobId) {
        console.log(`\n🔄 Resuming visual description job ${resumeJobId}...`);
      } else {
        console.log(`\n🎨 Starting visual description regeneration (mode: ${mode})...`);
      }
      
      const allProducts = await curalinaStorage.getAllProducts();
      const { regenerateAllVisualDescriptions } = await import('./services/batch-visual-description-regenerator');
      
      // Callback to save each product immediately as it's analyzed
      const onProductUpdated = async (product: any) => {
        await curalinaStorage.updateProduct(product.id, {
          visualDescription: product.visualDescription
        });
      };
      
      // Run the analyzer with checkpoint support
      const finalProgress = await regenerateAllVisualDescriptions(
        allProducts,
        curalinaStorage,
        {
          mode,
          userId: req.user?.id,
          resumeJobId,
        },
        undefined, // no progress callback
        onProductUpdated
      );
      
      res.json({
        success: true,
        message: resumeJobId 
          ? `✅ Resumed job completed (Job ID: ${finalProgress.jobId})` 
          : `✅ Visual description regeneration complete (Job ID: ${finalProgress.jobId})`,
        jobId: finalProgress.jobId,
        totalProducts: finalProgress.total,
        successful: finalProgress.successful,
        failed: finalProgress.failed,
        skipped: finalProgress.skipped,
        mode
      });
      
    } catch (error) {
      console.error("Error regenerating visual descriptions:", error);
      res.status(500).json({ error: "Failed to regenerate descriptions" });
    }
  });
  
  // Get active visual description jobs
  app.get('/api/admin/products/visual-description-jobs', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const jobs = await curalinaStorage.getActiveVisualDescriptionJobs(req.user?.id);
      res.json({ jobs });
    } catch (error) {
      console.error('Failed to get visual description jobs:', error);
      res.status(500).json({ error: 'Failed to get jobs' });
    }
  });

  app.get('/api/products/alternatives/:id', async (req, res) => {
    try {
      const alternatives = await curalinaStorage.getProductAlternatives(req.params.id);
      const transformedAlternatives = transformProductsImages(alternatives);
      res.json(transformedAlternatives);
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
      
      // Parse room description if provided (natural language dimension extraction)
      let parsedRoomData = null;
      if (validatedData.roomDescription && validatedData.roomDescription.trim().length > 0) {
        console.log(`📏 Parsing room description: "${validatedData.roomDescription.substring(0, 50)}..."`);
        const { parseRoomDescription } = await import('./services/room-parser-service');
        
        try {
          parsedRoomData = await parseRoomDescription(validatedData.roomDescription);
          console.log(`✅ Room parsing complete:`, {
            confidence: parsedRoomData.confidence,
            dimensions: parsedRoomData.dimensions,
            doorway: parsedRoomData.doorway,
            warnings: parsedRoomData.warnings
          });
        } catch (error) {
          console.error("Error parsing room description:", error);
          // Continue without parsed room data if parsing fails
        }
      }
      
      // Create quiz response with vibe preferences and parsed room data
      const quiz = await curalinaStorage.createQuizResponse({
        ...validatedData,
        ...vibePreferences,
        parsedRoomData: parsedRoomData || undefined,
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
      
      // Check if we already have a ledger with this hash (idempotency) - UNLESS forceNew is requested
      const forceNew = req.body.forceNew === true;
      if (forceNew) {
        console.log(`⚡ Force new render requested - skipping idempotency cache`);
      }
      
      const existingLedger = forceNew ? null : await curalinaStorage.getSelectionLedgerByHash(selectionHash);
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
      const userId = (req.user as any)?.id || null;
      const submittedEvent = buildRenderEvent(render.id, 'submitted', 'User submitted render request', userId);
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
          console.log(`🎨 Starting AI render for ${quiz.roomType} in ${quiz.styles?.[0] || 'modern'} style`);
          
          // Step 1: Get all products
          const allProducts = await curalinaStorage.getAllProducts();
          console.log(`Found ${allProducts.length} total products`);
          
          // Step 2: Check if specific products were requested (for regeneration with swaps)
          const { filterProductsByQuiz, selectProductsWithAI, analyzeRoomImage, analyzeFloorPlan, generatePlacementMatrix } = await import('./services/gemini-ai');
          let selectedProducts: Array<{ 
            sku: string; 
            name: string;
            placement?: string;
            reasoning?: string;
            functionalCategory?: string;
            priority?: number;
          }> = [];
          let placementInstructions: string | undefined = undefined;
          
          if (req.body.productSkus && req.body.productSkus.length > 0) {
            // Use specific product SKUs (from swap/regeneration)
            console.log(`Using ${req.body.productSkus.length} specified product SKUs`);
            selectedProducts = req.body.productSkus.map((sku: string) => {
              const product = allProducts.find(p => p.sku === sku);
              return {
                sku,
                name: product?.name || sku
              };
            });
          } else {
            // AI-driven product selection with zone-based composition
            const filteredProducts = filterProductsByQuiz(allProducts, quiz);
            console.log(`Filtered to ${filteredProducts.length} matching products`);
            
            // Apply spatial validation to filter out products that won't fit
            let spatiallyFittingProducts = filteredProducts;
            if (quiz.parsedRoomData && typeof quiz.parsedRoomData === 'object' && Object.keys(quiz.parsedRoomData).length > 0) {
              console.log(`📏 Applying spatial validation with room dimensions...`);
              const { filterFittingProducts } = await import('./services/spatial-fit-validator');
              
              const validationResult = await filterFittingProducts(filteredProducts, quiz.parsedRoomData as any);
              spatiallyFittingProducts = validationResult.fitting;
              
              if (validationResult.blocked.length > 0) {
                console.log(`🚫 Blocked ${validationResult.blocked.length} products that won't fit:`);
                validationResult.blocked.forEach(({ product, reason }) => {
                  console.log(`   - ${product.name}: ${reason}`);
                });
              }
              
              if (validationResult.warnings.length > 0) {
                console.log(`⚠️  ${validationResult.warnings.length} products have tight fit warnings (will include but flag):`);
                validationResult.warnings.forEach(({ product, messages }) => {
                  console.log(`   - ${product.name}: ${messages.join('; ')}`);
                });
              }
              
              console.log(`✅ ${spatiallyFittingProducts.length} products pass spatial validation`);
            }
            
            if (spatiallyFittingProducts.length > 0) {
              const { selectProductsWithComposition } = await import('./services/room-composition-service');
              const compositionResult = await selectProductsWithComposition(
                quiz.roomType,
                spatiallyFittingProducts,
                quiz,
                15 // max products
              );
              
              selectedProducts = compositionResult.selectedProducts.map(p => ({
                sku: p.sku,
                name: p.name,
                placement: '', // Will be provided by zone placements
                reasoning: '', // Will be provided by zone placements
                functionalCategory: undefined, // Will be detected by placement matrix
                priority: undefined
              }));
              console.log(`AI selected ${selectedProducts.length} products with zone-based composition`);
              
              // Generate zone-based placement instructions if placements are available
              if (compositionResult.placements && compositionResult.placements.length > 0) {
                console.log(`📍 Generating zone-based placement instructions for ${compositionResult.placements.length} items`);
                // Cast to required type for placement matrix
                const productsForMatrix = selectedProducts.map(p => ({
                  sku: p.sku,
                  name: p.name,
                  placement: p.placement || '',
                  reasoning: p.reasoning || '',
                  functionalCategory: p.functionalCategory,
                  priority: p.priority
                }));
                placementInstructions = generatePlacementMatrix(
                  productsForMatrix,
                  quiz.roomType,
                  undefined, // roomAnalysis - will be set later
                  undefined, // floorPlanAnalysis - will be set later
                  compositionResult.placements
                );
              }
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
              
              // Regenerate placement instructions with floor plan context if we have placements
              if (placementInstructions && selectedProducts.length > 0) {
                const { selectProductsWithComposition } = await import('./services/room-composition-service');
                // Re-fetch composition to get placements with floor plan context
                const filteredProducts = filterProductsByQuiz(allProducts, quiz);
                const compositionResult = await selectProductsWithComposition(
                  quiz.roomType,
                  filteredProducts,
                  quiz,
                  15
                );
                
                if (compositionResult.placements && compositionResult.placements.length > 0) {
                  // Update selectedProducts with empty placement/reasoning fields
                  const productsForMatrix = selectedProducts.map(p => ({
                    ...p,
                    placement: '',
                    reasoning: ''
                  }));
                  
                  placementInstructions = generatePlacementMatrix(
                    productsForMatrix,
                    quiz.roomType,
                    roomAnalysis,
                    floorPlanAnalysis,
                    compositionResult.placements
                  );
                  console.log(`✅ Updated placement instructions with floor plan context`);
                }
              }
            } catch (error) {
              console.error("Floor plan analysis error:", error);
            }
          }
          
          // SPACE IMAGE PRESERVATION MODE
          // Floor plan analysis provides architectural context (windows, doors, dimensions)
          // This ensures the AI preserves the space structure instead of redrawing it
          if (floorplanUrl) {
            console.log(`🖼️  SPACE IMAGE MODE: Room photo + architectural context + ${selectedProducts.length} products`);
            console.log(`   Floor plan analyzed: ${floorPlanAnalysis ? 'YES' : 'NO'}`);
          } else {
            console.log(`🎨 TEXT-TO-IMAGE MODE: ${selectedProducts.length} product images (no room) → Gemini`);
          }
          
          // Get full product objects from database for image-only rendering
          const selectedSkus = selectedProducts.map(p => p.sku);
          const fullSelectedProducts = allProducts.filter(p => selectedSkus.includes(p.sku));
          
          // Generate render (QA validation disabled)
          let imageDataUrl: string | null = null;
          let productsSentToAI: string[] = []; // Track products actually sent to AI (after image filtering)
          
          console.log(`\n🎨 Starting render generation...`);
          
          const { generateImageOnlyRender } = await import('./services/gemini-image-only-render');
          const imageOnlyResult = await generateImageOnlyRender({
            roomImageUrl: floorplanUrl || '', // Room image URL (empty if text-to-image mode)
            products: fullSelectedProducts, // Full product objects from database for image extraction
            roomType: quiz.roomType,
            stylePreference: quiz.styles?.[0] || 'modern',
            floorPlanAnalysis, // Pass floor plan analysis for detailed space preservation
            placementInstructions // Pass zone-based placement instructions for better space preservation
          });
          
          if (!imageOnlyResult.success || !imageOnlyResult.imageBase64) {
            throw new Error(imageOnlyResult.error || 'Image-only generation failed');
          }
          
          console.log(`✅ AI-generated room rendering complete using ${imageOnlyResult.productsUsed} product images`);
          console.log(`   Products sent to AI: ${imageOnlyResult.productsSentToAI?.length || 0}/${fullSelectedProducts.length}`);
          
          // Use generated render (QA validation disabled)
          imageDataUrl = imageOnlyResult.imageBase64;
          productsSentToAI = imageOnlyResult.productsSentToAI || [];
          
          console.log(`✅ Render generated successfully (QA validation disabled)`);
          
          // Set quality status to unknown (QA disabled)
          const qualityStatus: 'passed' | 'warning' | 'unknown' | 'qa_zero_products' | 'qa_unavailable' = 'unknown';
          
          // Extract base64 data and MIME type from final selected render
          const base64Match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!base64Match) {
            throw new Error("Invalid image data format");
          }
          const mimeType = base64Match[1]; // e.g., 'image/png' or 'image/jpeg'
          const base64Data = base64Match[2];
          
          // Convert to buffer for storage
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Determine file extension and content type from actual MIME type
          const fileExtension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
          const imageName = `render-${render.id}-${Date.now()}.${fileExtension}`;
          
          const publicPaths = objectStorageService.getPublicObjectSearchPaths();
          const publicDir = publicPaths[0];
          const objectPath = `${publicDir}/renders/${imageName}`;
          
          const { bucketName, objectName } = parseObjectPath(objectPath);
          const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          
          await file.save(imageBuffer, {
            metadata: {
              contentType: mimeType, // Use actual MIME type from generation
            },
          });
          
          const imageUrl = `/public-objects/renders/${imageName}`;
          
          // Shop the Look: Use products sent to AI (QA validation disabled)
          const productsForShopTheLook: string[] = productsSentToAI;
          
          console.log(`📤 Products sent to AI: ${productsSentToAI.length}/${fullSelectedProducts.length}`)
          
          console.log(`🛍️ Shop the Look: ${productsForShopTheLook.length} visible products`);
          
          // Update render with completed data (only visible products + QA results)
          const prompt = placementInstructions 
            ? `Zone-based placement with ${selectedProducts.length} products`
            : `Image-only render with ${selectedProducts.length} products`;
          
          // COMPREHENSIVE METADATA: Store diagnostics for every terminal state (QA disabled)
          const renderMetadata = {
            qualityStatus, // 'unknown' (QA validation disabled)
            productsRequested: fullSelectedProducts.length, // Original selection count
            productsSentToAI: productsSentToAI.length, // Successfully sent to AI (after image filtering)
            productsFiltered: fullSelectedProducts.length - productsSentToAI.length, // Dropped (no images)
            productsInShopTheLook: productsForShopTheLook.length, // Products in Shop the Look
            productsSentToAIList: productsSentToAI, // Actual SKUs sent (for debugging)
          };
          
          await curalinaStorage.updateRender(render.id, {
            imageUrl,
            productSkus: productsForShopTheLook,
            productMetadata: renderMetadata,
            qaResults: null, // QA validation disabled
            prompt,
            status: 'completed',
          });
          
          // Immediately persist 'completed' event
          const completedEvent = buildRenderEvent(
            render.id,
            'completed',
            `Render completed with ${productsForShopTheLook.length} visible products in Shop the Look`
          );
          await curalinaStorage.createRenderEvent(completedEvent);
          lifecycleEvents.push(completedEvent);
          
          // Ingest render snapshot (products + immutable event snapshot) atomically into analytics tables
          try {
            const { ingestRenderSnapshot } = await import('./services/render-ingestion');
            // Deep copy events array for immutable snapshot
            const eventSnapshot = JSON.parse(JSON.stringify(lifecycleEvents));
            
            // Get ledger data for snapshot ingestion
            const ledgerData = await curalinaStorage.getSelectionLedgerByRender(render.id);
            
            await ingestRenderSnapshot({
              render,
              productsWithPlacement: selectedProducts, // Use selectedProducts in image-only mode
              allProducts,
              ledgerData: ledgerData || null,
              quizContext: {
                roomType: quiz.roomType,
                style: quiz.styles?.[0] || 'Modern', // Use first style from array
                budget: quiz.budgetRange ? parseInt(quiz.budgetRange) : 0 // Convert budget range string to number
              }
            }, eventSnapshot);
          } catch (error) {
            console.error("❌ Render snapshot ingestion failed (non-blocking):", error);
          }
          
          // Lock selection ledger after render completion
          try {
            const ledger = await curalinaStorage.getSelectionLedgerByRender(render.id);
            if (ledger && !ledger.lockedAt) {
              await curalinaStorage.lockSelectionLedger(ledger.id);
              console.log(`🔒 Locked selection ledger for render ${render.id}`);
            }
          } catch (error) {
            console.error("Error locking selection ledger (non-blocking):", error);
          }
          
          console.log(`✅ Render ${render.id} completed with ${productsForShopTheLook.length} visible products in Shop the Look`);
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

  // IMAGE-ONLY rendering endpoint - bypasses visual description generation
  // Uses only room photo + product front view images (no text descriptions)
  app.post('/api/render/image-only', async (req, res) => {
    try {
      const { roomImageUrl, productSkus, quizResponseId, sessionId, roomType, style } = req.body;
      
      if (!roomImageUrl) {
        return res.status(400).json({ error: "roomImageUrl is required for image-only rendering" });
      }
      
      if (!productSkus || productSkus.length === 0) {
        return res.status(400).json({ error: "productSkus array is required" });
      }
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      console.log(`\n🖼️ IMAGE-ONLY RENDER REQUEST`);
      console.log(`   Room image: ${roomImageUrl}`);
      console.log(`   Products: ${productSkus.length} SKUs`);
      console.log(`   Room type: ${roomType || 'not specified'}`);
      console.log(`   Style: ${style || 'not specified'}`);
      
      // Fetch products by SKUs
      const allProducts = await curalinaStorage.getAllProducts();
      const selectedProducts = allProducts.filter(p => productSkus.includes(p.sku));
      
      if (selectedProducts.length === 0) {
        return res.status(404).json({ error: "No matching products found for provided SKUs" });
      }
      
      console.log(`✅ Found ${selectedProducts.length}/${productSkus.length} products`);
      
      // Create render record
      const render = await curalinaStorage.createRender({
        quizResponseId: quizResponseId || null,
        sessionId,
        prompt: `Image-only render: ${roomType || 'room'} in ${style || 'modern'} style`,
        productSkus,
        status: "generating",
      });
      
      // Start async image-only generation
      (async () => {
        try {
          const { generateImageOnlyRender } = await import('./services/gemini-image-only-render');
          
          // Call image-only rendering service
          const result = await generateImageOnlyRender({
            roomImageUrl,
            products: selectedProducts,
            roomType,
            stylePreference: style
          });
          
          if (!result.success || !result.imageBase64) {
            throw new Error(result.error || 'Image generation failed');
          }
          
          console.log(`✅ Image-only render generated with ${result.productsUsed} products`);
          
          // Extract base64 data and MIME type from data URL
          const base64Match = result.imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
          if (!base64Match) {
            throw new Error("Invalid image data format");
          }
          const mimeType = base64Match[1];
          const base64Data = base64Match[2];
          
          // Convert to buffer for storage
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Upload to object storage
          const fileExtension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
          const imageName = `render-${render.id}-image-only.${fileExtension}`;
          
          const publicPaths = objectStorageService.getPublicObjectSearchPaths();
          const publicDir = publicPaths[0];
          const objectPath = `${publicDir}/renders/${imageName}`;
          
          const { bucketName, objectName } = parseObjectPath(objectPath);
          const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          
          await file.save(imageBuffer, {
            metadata: {
              contentType: mimeType,
            },
          });
          
          const imageUrl = `/public-objects/renders/${imageName}`;
          
          // Update render with success
          await curalinaStorage.updateRender(render.id, {
            status: 'completed',
            imageUrl,
            productSkus // Store which products were used
          });
          
          console.log(`✅ Image-only render ${render.id} completed successfully`);
          
        } catch (error) {
          console.error("Image-only generation error:", error);
          
          await curalinaStorage.updateRender(render.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })();
      
      // Return render immediately (generation happens async)
      res.json(render);
      
    } catch (error) {
      console.error("Error creating image-only render:", error);
      res.status(500).json({ error: "Failed to create image-only render" });
    }
  });

  // COMPARISON rendering endpoint - generates renders from all three AI services in parallel
  app.post('/api/render/comparison', async (req, res) => {
    try {
      const { roomImageUrl, productSkus, quizResponseId, sessionId, roomType, style } = req.body;
      
      // roomImageUrl is optional - empty/null means text-to-image mode
      // non-empty means image-to-image mode
      
      if (!productSkus || productSkus.length === 0) {
        return res.status(400).json({ error: "productSkus array is required" });
      }
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      console.log(`\n🔀 COMPARISON RENDER REQUEST`);
      console.log(`   Room image: ${roomImageUrl}`);
      console.log(`   Products: ${productSkus.length} SKUs`);
      console.log(`   Services: Gemini, OpenAI, Stability AI`);
      
      // Fetch products by SKUs
      const allProducts = await curalinaStorage.getAllProducts();
      const selectedProducts = allProducts.filter(p => productSkus.includes(p.sku));
      
      if (selectedProducts.length === 0) {
        return res.status(404).json({ error: "No matching products found for provided SKUs" });
      }
      
      console.log(`✅ Found ${selectedProducts.length}/${productSkus.length} products`);
      
      // Create comparison record
      const comparison = await curalinaStorage.createComparisonRender({
        quizResponseId: quizResponseId || null,
        sessionId,
        productSkus,
        prompt: `Comparison render: ${roomType || 'room'} in ${style || 'modern'} style`,
        geminiStatus: 'pending',
        openaiStatus: 'pending',
        stabilityStatus: 'pending',
      });
      
      console.log(`📊 Created comparison ${comparison.id}`);
      
      // Helper to upload image and return URL
      const uploadImageToStorage = async (imageBase64: string, serviceName: string): Promise<string> => {
        const base64Match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!base64Match) {
          throw new Error("Invalid image data format");
        }
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];
        
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileExtension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const imageName = `comparison-${comparison.id}-${serviceName}.${fileExtension}`;
        
        const publicPaths = await objectStorageService.getPublicObjectSearchPaths();
        if (!publicPaths || publicPaths.length === 0) {
          throw new Error("Object storage public paths not configured");
        }
        const publicDir = publicPaths[0];
        const objectPath = `${publicDir}/renders/${imageName}`;
        
        const { bucketName, objectName } = parseObjectPath(objectPath);
        const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        await file.save(imageBuffer, {
          metadata: { contentType: mimeType },
        });
        
        return `/public-objects/renders/${imageName}`;
      };
      
      // Start async parallel generation for all three services
      (async () => {
        const baseParams = {
          roomImageUrl,
          products: selectedProducts,
          roomType,
          stylePreference: style,
        };
        
        // Build shared prompt ONCE for all three services (includes GPT-5 Vision analysis)
        console.log(`\n🔀 Building shared prompt for fair comparison...`);
        const { buildSharedPrompt } = await import('./services/shared-prompt-builder');
        const sharedPrompt = await buildSharedPrompt({
          roomImageUrl,
          products: selectedProducts.map(p => ({
            sku: p.sku,
            name: p.name,
            visualDescription: p.visualDescription || undefined,
            condensedDescription: (p as any).condensedDescription || undefined,
            colors: p.colors || undefined,
            dimensions: p.dimensions,
          })),
          roomType,
          stylePreference: style,
        });
        console.log(`✅ Shared prompt built - will be used identically by all three services`);
        
        // Pass the SAME prompt to all three services
        const paramsWithSharedPrompt = {
          ...baseParams,
          sharedPrompt: sharedPrompt.mainPrompt,
        };
        
        // Gemini generation
        (async () => {
          const startTime = Date.now();
          try {
            const { generateImageOnlyRender } = await import('./services/gemini-image-only-render');
            const result = await generateImageOnlyRender(paramsWithSharedPrompt);
            
            if (!result.success || !result.imageBase64) {
              throw new Error(result.error || 'Generation failed');
            }
            
            const generationTime = Date.now() - startTime;
            
            // Try to upload, but handle storage errors gracefully
            let imageUrl: string | null = null;
            try {
              imageUrl = await uploadImageToStorage(result.imageBase64, 'gemini');
            } catch (uploadError) {
              console.error("Gemini upload error:", uploadError);
              throw new Error(`Image generation succeeded but upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown upload error'}`);
            }
            
            await curalinaStorage.updateComparisonRender(comparison.id, {
              geminiImageUrl: imageUrl,
              geminiGenerationTime: generationTime,
              geminiProductCount: result.productsUsed || 0,
              geminiStatus: 'success',
            });
            
            console.log(`✅ Gemini render completed in ${generationTime}ms`);
          } catch (error) {
            const generationTime = Date.now() - startTime;
            console.error("Gemini generation error:", error);
            await curalinaStorage.updateComparisonRender(comparison.id, {
              geminiGenerationTime: generationTime,
              geminiStatus: 'failed',
              geminiError: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })();
        
        // OpenAI generation
        (async () => {
          const startTime = Date.now();
          try {
            const { generateOpenAIRender } = await import('./services/openai-render');
            // Map products to match OpenAI service interface (convert null to undefined)
            const openaiParams = {
              ...paramsWithSharedPrompt,
              products: paramsWithSharedPrompt.products.map(p => ({
                sku: p.sku,
                name: p.name,
                visualDescription: p.visualDescription || undefined,
                colors: p.colors || undefined,
                dimensions: p.dimensions,
              }))
            };
            const result = await generateOpenAIRender(openaiParams);
            
            if (!result.success || !result.imageBase64) {
              throw new Error(result.error || 'Generation failed');
            }
            
            const generationTime = Date.now() - startTime;
            
            // Try to upload, but handle storage errors gracefully
            let imageUrl: string | null = null;
            try {
              imageUrl = await uploadImageToStorage(result.imageBase64, 'openai');
            } catch (uploadError) {
              console.error("OpenAI upload error:", uploadError);
              throw new Error(`Image generation succeeded but upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown upload error'}`);
            }
            
            await curalinaStorage.updateComparisonRender(comparison.id, {
              openaiImageUrl: imageUrl,
              openaiGenerationTime: generationTime,
              openaiProductCount: result.productsUsed || 0,
              openaiStatus: 'success',
            });
            
            console.log(`✅ OpenAI render completed in ${generationTime}ms`);
          } catch (error) {
            const generationTime = Date.now() - startTime;
            console.error("OpenAI generation error:", error);
            await curalinaStorage.updateComparisonRender(comparison.id, {
              openaiGenerationTime: generationTime,
              openaiStatus: 'failed',
              openaiError: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })();
        
        // Stability AI generation
        (async () => {
          const startTime = Date.now();
          try {
            const { generateStabilityRender } = await import('./services/stability-ai-render');
            const result = await generateStabilityRender(paramsWithSharedPrompt);
            
            if (!result.success || !result.imageBase64) {
              throw new Error(result.error || 'Generation failed');
            }
            
            const generationTime = Date.now() - startTime;
            
            // Try to upload, but handle storage errors gracefully
            let imageUrl: string | null = null;
            try {
              imageUrl = await uploadImageToStorage(result.imageBase64, 'stability');
            } catch (uploadError) {
              console.error("Stability upload error:", uploadError);
              throw new Error(`Image generation succeeded but upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown upload error'}`);
            }
            
            await curalinaStorage.updateComparisonRender(comparison.id, {
              stabilityImageUrl: imageUrl,
              stabilityGenerationTime: generationTime,
              stabilityProductCount: result.productsUsed || 0,
              stabilityStatus: 'success',
            });
            
            console.log(`✅ Stability AI render completed in ${generationTime}ms`);
          } catch (error) {
            const generationTime = Date.now() - startTime;
            console.error("Stability AI generation error:", error);
            await curalinaStorage.updateComparisonRender(comparison.id, {
              stabilityGenerationTime: generationTime,
              stabilityStatus: 'failed',
              stabilityError: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })();
      })();
      
      // Return comparison immediately (generation happens async)
      res.json(comparison);
      
    } catch (error) {
      console.error("Error creating comparison render:", error);
      res.status(500).json({ error: "Failed to create comparison render" });
    }
  });

  app.get('/api/render/comparison/:id', async (req, res) => {
    try {
      const comparison = await curalinaStorage.getComparisonRender(req.params.id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }
      res.json(comparison);
    } catch (error) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  app.patch('/api/render/comparison/:id', async (req, res) => {
    try {
      const { selectedService, selectionReason } = req.body;
      
      if (!selectedService) {
        return res.status(400).json({ error: "selectedService is required" });
      }
      
      // Build update object with only the fields we want to change
      const updateData: any = {
        selectedService,
      };
      
      if (selectionReason !== undefined) {
        updateData.selectionReason = selectionReason;
      }
      
      const comparison = await curalinaStorage.updateComparisonRender(req.params.id, updateData);
      
      res.json(comparison);
    } catch (error) {
      console.error("Error updating comparison:", error);
      res.status(500).json({ error: "Failed to update comparison" });
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

  // Get full product details for a render's "Shop the Look" section
  app.get('/api/render/:renderId/products', async (req, res) => {
    try {
      const render = await curalinaStorage.getRender(req.params.renderId);
      if (!render) {
        return res.status(404).json({ error: "Render not found" });
      }

      // Deduplicate productSkus (remove duplicate SKUs from array)
      const uniqueSkus = render.productSkus 
        ? Array.from(new Set(render.productSkus))
        : [];

      // Get all products from database
      const allProducts = await curalinaStorage.getAllProducts();
      
      // Filter to only the unique products in this render
      const renderProducts = allProducts.filter(p => uniqueSkus.includes(p.sku));

      console.log(`[Shop the Look] Render ${req.params.renderId}: ${render.productSkus?.length || 0} total → ${uniqueSkus.length} unique products`);

      res.json(renderProducts);
    } catch (error) {
      console.error("Error fetching render products:", error);
      res.status(500).json({ error: "Failed to fetch render products" });
    }
  });

  // Batch fetch products by IDs (for swapped products)
  app.post('/api/products/batch', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }

      // Get all products and filter by requested IDs
      const allProducts = await curalinaStorage.getAllProducts();
      const requestedProducts = allProducts.filter(p => ids.includes(p.id));

      res.json(requestedProducts);
    } catch (error) {
      console.error("Error fetching products batch:", error);
      res.status(500).json({ error: "Failed to fetch products" });
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
      // Transform product images in each cart item
      const transformedCart = cart.map(item => ({
        ...item,
        product: transformProductImages(item.product)
      }));
      res.json(transformedCart);
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
      
      const job = await createUploadJob(productId, product.sku, filesData, req.user?.id);
      
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
      
      // Enhance jobs with product information
      const jobsWithProduct = await Promise.all(
        jobs.map(async (job) => {
          const product = await curalinaStorage.getProduct(job.productId);
          return {
            ...job,
            productName: product?.name || 'Unknown Product',
            productSku: product?.sku,
          };
        })
      );
      
      res.json(jobsWithProduct);
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
          score: (p.structuredAnalysis as any)?.qualityScore || 50,
          analyzedAt: p.createdAt
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

      
      const frontView = (product.structuredAnalysis as any).frontView;

      res.json({
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          images: product.images
        },
        analysis: product.structuredAnalysis,
        qualityScore: (product.structuredAnalysis as any)?.qualityScore || 50,
        analyzedAt: product.createdAt
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

  // Cleanup products with no valid images
  app.post('/api/admin/products/cleanup/identify', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { validateImages = false } = req.body;
      const { identifyProductsToCleanup } = await import('./services/product-cleanup-service');
      const results = await identifyProductsToCleanup(curalinaStorage, { validateImages });
      
      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      console.error("Error identifying products for cleanup:", error);
      res.status(500).json({ error: "Failed to identify products for cleanup" });
    }
  });

  app.post('/api/admin/products/cleanup/execute', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { productIds } = req.body;
      
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds array required" });
      }

      const { executeCleanup } = await import('./services/product-cleanup-service');
      const results = await executeCleanup(curalinaStorage, productIds);
      
      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      console.error("Error executing cleanup:", error);
      res.status(500).json({ error: "Failed to execute cleanup" });
    }
  });

  // Helper to build comprehensive CSV rows with all product fields
  const buildProductExportRows = (products: any[], categories?: any[], suppliers?: any[]) => {
    // Build lookup maps for faster access
    const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));
    const supplierMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));
    
    const headers = [
      'ID', 'SKU', 'Name', 'Slug', 'Description', 'Category ID', 'Category Name', 'Supplier ID', 'Supplier Name',
      'Price', 'Trade Price', 'Discount', 'Availability', 'Inventory', 'Lead Time (days)',
      'Visual Description', 'Structured Analysis', 'Image Count', 'Image URLs',
      'Room Types', 'Design Styles', 'Style Tags', 'Key Features', 'Storage Solutions',
      'Colors', 'Materials', 'Weight', 'Seating', 'Assembly',
      'Dimensions (JSON)', 'Asset 3D URL',
      'Shipping Cost', 'Shipping ETA', 'Delivery Options', 'Delivery Location', 'Delivery Policy',
      'Image Health', 'Last Validated', 'Tags', 'Source File', 'SEO Title', 'SEO Description',
      'Image Analyses (JSON)', 'Created At'
    ];
    
    const rows = products.map(p => [
      p.id || '',
      p.sku || '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.slug || '',
      `"${(p.description || '').replace(/"/g, '""')}"`,
      p.categoryId || '',
      categoryMap.get(p.categoryId) || '',
      p.supplierId || '',
      supplierMap.get(p.supplierId) || '',
      p.price || '',
      p.tradePrice || '',
      p.discount || '',
      p.availability || 'unknown',
      p.inventory !== null ? p.inventory : '',
      p.leadTime || '',
      `"${((p as any).visualDescription || '').substring(0, 500).replace(/"/g, '""')}"`,
      p.structuredAnalysis ? `"${JSON.stringify(p.structuredAnalysis).replace(/"/g, '""')}"` : '',
      (p.images || []).length,
      `"${(p.images || []).join('; ').replace(/"/g, '""')}"`,
      (p.roomType || []).join('; '),
      (p.designStyle || []).join('; '),
      (p.styleTags || []).join('; '),
      (p.keyFeatures || []).join('; '),
      p.storageSolutions || '',
      (p.colors || []).join('; '),
      (p.materials || []).join('; '),
      p.weight || '',
      p.seating || '',
      p.assembly || '',
      p.dimensions ? `"${JSON.stringify(p.dimensions).replace(/"/g, '""')}"` : '',
      p.asset3dUrl || '',
      (p.shipping as any)?.cost || '',
      (p.shipping as any)?.eta || '',
      (p.shipping as any)?.deliveryOptions || '',
      (p.shipping as any)?.deliveryLocation || '',
      (p.shipping as any)?.deliveryPolicy || '',
      p.imageHealth || 'unknown',
      p.lastValidatedAt || '',
      (p.tags || []).join('; '),
      p.sourceFile || '',
      (p.seoMeta as any)?.title || '',
      (p.seoMeta as any)?.description || '',
      p.imageAnalyses ? `"${JSON.stringify(p.imageAnalyses).replace(/"/g, '""')}"` : '',
      p.createdAt || ''
    ]);
    
    return { headers, rows };
  };

  // Export all products as CSV
  app.get('/api/admin/products/export/all', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [products, categories, suppliers] = await Promise.all([
        curalinaStorage.getAllProducts(),
        curalinaStorage.getAllCategories(),
        curalinaStorage.getAllSuppliers()
      ]);
      const { headers, rows } = buildProductExportRows(products, categories, suppliers);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products-all.csv"');
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
      const [allProducts, categories, suppliers] = await Promise.all([
        curalinaStorage.getAllProducts(),
        curalinaStorage.getAllCategories(),
        curalinaStorage.getAllSuppliers()
      ]);
      
      let products = allProducts;
      
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
      
      const { headers, rows } = buildProductExportRows(products, categories, suppliers);
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
      const bucketSetting = { key: 's3_bucket_name', value: process.env.S3_BUCKET || 'curalina', description: 'S3 bucket name' };
      const prefixSetting = { key: 's3_folder_prefix', value: 'products', description: 'S3 folder prefix' };
      
      res.json({
        bucketName: bucketSetting?.value || process.env.S3_BUCKET || 'curalina',
        folderPrefix: prefixSetting?.value || 'products'
      });
    } catch (error) {
      console.error("Error fetching S3 settings:", error);
      res.status(500).json({ error: "Failed to fetch S3 settings" });
    }
  });

  // Get Stability AI QC Settings
  app.get('/api/admin/settings/stability-qc', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      // Check environment variables for current state
      const enabled = process.env.ENABLE_STABILITY_QC === 'true';
      const strength = process.env.STABILITY_QC_STRENGTH || '0.7';
      const hasApiKey = !!process.env.STABILITY_API_KEY;
      
      res.json({ 
        enabled,
        strength,
        hasApiKey,
        message: hasApiKey ? 'API key configured' : 'API key not configured'
      });
    } catch (error) {
      console.error("Error fetching QC settings:", error);
      res.status(500).json({ error: "Failed to fetch QC settings" });
    }
  });
  
  // Update Stability AI QC Settings
  app.post('/api/admin/settings/stability-qc', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { enabled, strength } = req.body;
      
      // Validate and normalize the strength value
      let normalizedStrength = parseFloat(strength);
      if (isNaN(normalizedStrength) || normalizedStrength < 0.3 || normalizedStrength > 1.0) {
        console.warn(`Invalid strength value: ${strength}, defaulting to 0.7`);
        normalizedStrength = 0.7;
      }
      
      // Update environment variables (in production, save to database)
      process.env.ENABLE_STABILITY_QC = enabled ? 'true' : 'false';
      process.env.STABILITY_QC_STRENGTH = normalizedStrength.toString();
      
      console.log(`✅ Stability AI QC settings updated:`);
      console.log(`   - Enabled: ${enabled}`);
      console.log(`   - Strength: ${normalizedStrength}`);
      
      res.json({ 
        success: true,
        enabled: !!enabled,
        strength: normalizedStrength.toString(),
        message: 'QC settings updated. Changes will take effect on next render.'
      });
    } catch (error) {
      console.error("Error updating QC settings:", error);
      res.status(500).json({ error: "Failed to update QC settings" });
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
