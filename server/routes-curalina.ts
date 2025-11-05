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
      res.status(500).json({ error: "Failed to upload image" });
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

  // File upload endpoint
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const folder = req.body.folder || 'uploads';
      const fileName = `${Date.now()}-${req.file.originalname}`;
      
      // Use public directory so files are accessible via /public-objects route
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const publicDir = publicPaths[0]; // Use first public path
      const objectPath = `${publicDir}/${folder}/${fileName}`;

      // Upload to object storage
      const { bucketName, objectName } = parseObjectPath(objectPath);
      const bucket = (await import('./objectStorage')).objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      // Make file public
      await file.makePublic();
      
      const publicUrl = `/public-objects/${folder}/${fileName}`;
      
      res.json({ url: publicUrl });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
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

      // Build prompt from quiz data
      const prompt = buildPromptFromQuiz(quiz);
      
      // Create render record with status 'generating'
      const render = await curalinaStorage.createRender({
        ...renderData,
        sessionId: quiz.sessionId,
        prompt,
      });

      // Return immediately with status 'generating'
      res.json(render);

      // Start async AI generation process
      (async () => {
        try {
          // Generate image with Gemini AI
          const floorplanUrl = quiz.floorplanUrl 
            ? `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}${quiz.floorplanUrl}`
            : undefined;
          
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
          
          await file.makePublic();
          const imageUrl = `/public-objects/renders/${imageName}`;
          
          // Extract featured product SKUs
          const allProducts = await curalinaStorage.getAllProducts();
          // Filter products to only include those with styleTags
          const productsWithTags = allProducts.filter(p => p.styleTags && p.styleTags.length > 0);
          const productSkus = extractProductSkus(quiz, productsWithTags as Array<{sku: string, styleTags: string[]}>);
          
          // Update render with completed data
          await curalinaStorage.updateRender(render.id, {
            imageUrl,
            productSkus,
            status: 'completed',
          });
          
          console.log(`✅ Render ${render.id} completed successfully`);
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
