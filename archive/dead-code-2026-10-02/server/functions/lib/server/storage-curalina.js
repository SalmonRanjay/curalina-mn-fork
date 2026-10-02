import { categories, suppliers, products, quizResponses, renders, selectionLedger, cartItems, orders, orderItems, users, designExamples, productPackages, placementGuidelines, designRules, uploadJobs, uploadJobFiles, visualAnalysisJobs, visualAnalysisProducts, s3RenamingJobs, s3RenamingProducts, visualDescriptionJobs, visualDescriptionProducts, renderProducts, renderEvents, documentationSections, documentationComments, productFunctionalCategories, comparisonRenders, } from "@shared/schema";
import { getDb } from "./db";
import { eq, and, inArray, desc, isNull, isNotNull, or, sql } from "drizzle-orm";
export class CuralinaStorage {
    // Category operations
    async getAllCategories() {
        return getDb().select().from(categories);
    }
    async getCategoriesByType(type) {
        return getDb().select().from(categories).where(eq(categories.type, type));
    }
    async getCategoryByName(name) {
        const [category] = await getDb().select().from(categories).where(eq(categories.name, name));
        return category;
    }
    async createCategory(categoryData) {
        const [category] = await getDb().insert(categories).values(categoryData).returning();
        return category;
    }
    async deleteCategory(id) {
        await getDb().delete(categories).where(eq(categories.id, id));
    }
    // Supplier operations
    async getAllSuppliers() {
        return getDb().select().from(suppliers);
    }
    async getSupplierByName(name) {
        const [supplier] = await getDb().select().from(suppliers).where(eq(suppliers.name, name));
        return supplier;
    }
    async createSupplier(supplierData) {
        const [supplier] = await getDb().insert(suppliers).values(supplierData).returning();
        return supplier;
    }
    async deleteSupplier(id) {
        await getDb().delete(suppliers).where(eq(suppliers.id, id));
    }
    // Product operations
    async getAllProducts(filters) {
        let query = getDb().select().from(products);
        const conditions = [];
        if (filters?.categoryId) {
            conditions.push(eq(products.categoryId, filters.categoryId));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        const results = await query;
        // Filter by style tags if provided
        if (filters?.styleTags && filters.styleTags.length > 0) {
            return results.filter(product => product.styleTags?.some(tag => filters.styleTags?.includes(tag)));
        }
        return results;
    }
    async getProducts() {
        return getDb().select().from(products);
    }
    async getProduct(id) {
        const [product] = await getDb().select().from(products).where(eq(products.id, id));
        return product;
    }
    async getProductBySku(sku) {
        const [product] = await getDb().select().from(products).where(eq(products.sku, sku));
        return product;
    }
    async getProductAlternatives(productId) {
        const product = await this.getProduct(productId);
        if (!product)
            return [];
        // Find products with same category and overlapping style tags
        const alternatives = await db
            .select()
            .from(products)
            .where(eq(products.categoryId, product.categoryId))
            .limit(7); // Get 7 to filter out the original product
        return alternatives
            .filter(p => p.id !== productId &&
            p.styleTags?.some(tag => product.styleTags?.includes(tag)))
            .slice(0, 6);
    }
    async createProduct(productData) {
        const [product] = await getDb().insert(products).values(productData).returning();
        return product;
    }
    async updateProduct(id, productData) {
        const [product] = await db
            .update(products)
            .set(productData)
            .where(eq(products.id, id))
            .returning();
        return product;
    }
    async setProductImageHealthStatus(id, status, metadata) {
        // First, get the current product to preserve existing imageAnalyses
        const [existingProduct] = await getDb().select().from(products).where(eq(products.id, id));
        if (!existingProduct) {
            throw new Error("Product not found");
        }
        const updateData = {
            imageHealth: status,
            lastValidatedAt: new Date(),
        };
        // Merge metadata with existing imageAnalyses to preserve audit trail
        if (metadata) {
            const existingAnalyses = existingProduct.imageAnalyses || {};
            // Create health history array if it doesn't exist
            const healthHistory = existingAnalyses.healthHistory || [];
            healthHistory.push({
                status,
                timestamp: new Date().toISOString(),
                ...metadata
            });
            updateData.imageAnalyses = {
                ...existingAnalyses,
                healthHistory,
                lastHealthAction: metadata
            };
        }
        const [product] = await db
            .update(products)
            .set(updateData)
            .where(eq(products.id, id))
            .returning();
        return product;
    }
    async deleteProduct(id) {
        // Delete product and all related records in a transaction to ensure data integrity
        await getDb().transaction(async (tx) => {
            // First, get all upload jobs for this product
            const jobs = await tx.select().from(uploadJobs).where(eq(uploadJobs.productId, id));
            // Delete upload job files first (they reference upload jobs)
            for (const job of jobs) {
                await tx.delete(uploadJobFiles).where(eq(uploadJobFiles.jobId, job.id));
            }
            // Delete all other related records
            await tx.delete(uploadJobs).where(eq(uploadJobs.productId, id));
            await tx.delete(cartItems).where(eq(cartItems.productId, id));
            await tx.delete(renderProducts).where(eq(renderProducts.productId, id));
            await tx.delete(orderItems).where(eq(orderItems.productId, id));
            await tx.delete(visualAnalysisProducts).where(eq(visualAnalysisProducts.productId, id));
            await tx.delete(productFunctionalCategories).where(eq(productFunctionalCategories.productId, id));
            // Finally delete the product itself
            await tx.delete(products).where(eq(products.id, id));
        });
    }
    async updateProductStructuredAnalysis(id, analysis, quality) {
        const [product] = await db
            .update(products)
            .set({
            structuredAnalysis: analysis,
            structuredAnalysisQuality: quality.toString(),
            structuredAnalysisUpdatedAt: new Date(),
        })
            .where(eq(products.id, id))
            .returning();
        return product;
    }
    async getProductsByQualityScore(minScore = 0, maxScore = 100) {
        return db
            .select()
            .from(products)
            .where(and(isNotNull(products.structuredAnalysisQuality), sql `${products.structuredAnalysisQuality} >= ${minScore}`, sql `${products.structuredAnalysisQuality} <= ${maxScore}`))
            .orderBy(desc(products.structuredAnalysisQuality));
    }
    async getProductsNeedingAnalysis(limit = 50) {
        return db
            .select()
            .from(products)
            .where(or(isNull(products.structuredAnalysisQuality), sql `${products.structuredAnalysisQuality} < 60`))
            .orderBy(desc(products.createdAt))
            .limit(limit);
    }
    // Quiz operations
    async createQuizResponse(quizData) {
        const [quiz] = await getDb().insert(quizResponses).values(quizData).returning();
        return quiz;
    }
    async getQuizResponse(id) {
        const [quiz] = await getDb().select().from(quizResponses).where(eq(quizResponses.id, id));
        return quiz;
    }
    // Render operations
    async createRender(renderData) {
        const [render] = await getDb().insert(renders).values(renderData).returning();
        return render;
    }
    async updateRender(id, data) {
        const [render] = await db
            .update(renders)
            .set(data)
            .where(eq(renders.id, id))
            .returning();
        return render;
    }
    async getRender(id) {
        const [render] = await getDb().select().from(renders).where(eq(renders.id, id));
        return render;
    }
    async getLatestRenderBySession(sessionId) {
        const [render] = await db
            .select()
            .from(renders)
            .where(eq(renders.sessionId, sessionId))
            .orderBy(desc(renders.createdAt))
            .limit(1);
        return render;
    }
    async getRendersBySession(sessionId) {
        return db
            .select()
            .from(renders)
            .where(eq(renders.sessionId, sessionId))
            .orderBy(desc(renders.createdAt));
    }
    // Comparison Render operations
    async createComparisonRender(comparisonData) {
        const [comparison] = await getDb().insert(comparisonRenders).values(comparisonData).returning();
        return comparison;
    }
    async getComparisonRender(id) {
        const [comparison] = await getDb().select().from(comparisonRenders).where(eq(comparisonRenders.id, id));
        return comparison;
    }
    async updateComparisonRender(id, data) {
        const [comparison] = await db
            .update(comparisonRenders)
            .set(data)
            .where(eq(comparisonRenders.id, id))
            .returning();
        return comparison;
    }
    async getLatestComparisonRenderBySession(sessionId) {
        const [comparison] = await db
            .select()
            .from(comparisonRenders)
            .where(eq(comparisonRenders.sessionId, sessionId))
            .orderBy(desc(comparisonRenders.createdAt))
            .limit(1);
        return comparison;
    }
    // Selection Ledger operations
    async createSelectionLedger(ledgerData) {
        const [ledger] = await getDb().insert(selectionLedger).values(ledgerData).returning();
        return ledger;
    }
    async getSelectionLedgerByHash(hash) {
        const [ledger] = await db
            .select()
            .from(selectionLedger)
            .where(eq(selectionLedger.selectionHash, hash))
            .limit(1);
        return ledger;
    }
    async getSelectionLedgerByRender(renderId) {
        const [ledger] = await db
            .select()
            .from(selectionLedger)
            .where(eq(selectionLedger.renderId, renderId))
            .limit(1);
        return ledger;
    }
    async getAllLedgers(limit = 100) {
        return db
            .select()
            .from(selectionLedger)
            .orderBy(desc(selectionLedger.createdAt))
            .limit(limit);
    }
    async updateSelectionLedgerDetails(id, details) {
        const updateData = {};
        if (details.selectionRationale !== undefined) {
            updateData.selectionRationale = details.selectionRationale;
        }
        if (details.compositionOrder !== undefined) {
            updateData.compositionOrder = details.compositionOrder;
        }
        if (details.diversityScore !== undefined) {
            updateData.diversityScore = details.diversityScore;
        }
        const [ledger] = await db
            .update(selectionLedger)
            .set(updateData)
            .where(eq(selectionLedger.id, id))
            .returning();
        return ledger;
    }
    async lockSelectionLedger(id) {
        const [ledger] = await db
            .update(selectionLedger)
            .set({ lockedAt: new Date() })
            .where(eq(selectionLedger.id, id))
            .returning();
        return ledger;
    }
    async deleteSelectionLedger(id) {
        await getDb().delete(selectionLedger).where(eq(selectionLedger.id, id));
    }
    // Cart operations
    async getCartBySession(sessionId) {
        const items = await db
            .select({
            cartItem: cartItems,
            product: products,
        })
            .from(cartItems)
            .innerJoin(products, eq(cartItems.productId, products.id))
            .where(eq(cartItems.sessionId, sessionId));
        return items.map(({ cartItem, product }) => ({
            ...cartItem,
            product,
        }));
    }
    async addToCart(itemData) {
        // Check if item already exists in cart
        const [existing] = await db
            .select()
            .from(cartItems)
            .where(and(eq(cartItems.sessionId, itemData.sessionId), eq(cartItems.productId, itemData.productId)));
        if (existing) {
            // Update quantity
            const newQuantity = existing.quantity + (itemData.quantity || 1);
            const [updated] = await db
                .update(cartItems)
                .set({ quantity: newQuantity })
                .where(eq(cartItems.id, existing.id))
                .returning();
            return updated;
        }
        // Create new cart item
        const [item] = await getDb().insert(cartItems).values(itemData).returning();
        return item;
    }
    async updateCartItem(id, quantity) {
        const [item] = await db
            .update(cartItems)
            .set({ quantity })
            .where(eq(cartItems.id, id))
            .returning();
        return item;
    }
    async removeFromCart(id) {
        await getDb().delete(cartItems).where(eq(cartItems.id, id));
    }
    async clearCart(sessionId) {
        await getDb().delete(cartItems).where(eq(cartItems.sessionId, sessionId));
    }
    // Order operations
    async createOrder(orderData, items) {
        const [order] = await getDb().insert(orders).values(orderData).returning();
        // Create order items
        if (items.length > 0) {
            const orderItemsData = items.map(item => ({
                ...item,
                orderId: order.id,
            }));
            await getDb().insert(orderItems).values(orderItemsData);
        }
        return order;
    }
    async getOrder(id) {
        const [order] = await getDb().select().from(orders).where(eq(orders.id, id));
        return order;
    }
    async getOrdersBySession(sessionId) {
        return db
            .select()
            .from(orders)
            .where(eq(orders.sessionId, sessionId))
            .orderBy(desc(orders.createdAt));
    }
    async getAllOrders() {
        return getDb().select().from(orders).orderBy(desc(orders.createdAt));
    }
    async updateOrderStatus(id, status) {
        const [order] = await db
            .update(orders)
            .set({ status, updatedAt: new Date() })
            .where(eq(orders.id, id))
            .returning();
        return order;
    }
    // User operations
    async getAllUsers() {
        return getDb().select().from(users).orderBy(desc(users.createdAt));
    }
    async updateUserRole(id, role) {
        const [user] = await db
            .update(users)
            .set({ role, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();
        return user;
    }
    // Admin operations
    async getAllRenders() {
        return getDb().select().from(renders).orderBy(desc(renders.createdAt));
    }
    async getAllQuizResponses() {
        return getDb().select().from(quizResponses).orderBy(desc(quizResponses.createdAt));
    }
    // AI Training Data operations
    // Design Examples
    async getAllDesignExamples(filters) {
        let query = getDb().select().from(designExamples);
        const conditions = [];
        if (filters?.type) {
            conditions.push(eq(designExamples.type, filters.type));
        }
        if (filters?.roomType) {
            conditions.push(eq(designExamples.roomType, filters.roomType));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        return query.orderBy(desc(designExamples.createdAt));
    }
    async getDesignExample(id) {
        const [example] = await getDb().select().from(designExamples).where(eq(designExamples.id, id));
        return example;
    }
    async createDesignExample(exampleData) {
        const [example] = await getDb().insert(designExamples).values(exampleData).returning();
        return example;
    }
    async updateDesignExample(id, exampleData) {
        const [example] = await db
            .update(designExamples)
            .set({ ...exampleData, updatedAt: new Date() })
            .where(eq(designExamples.id, id))
            .returning();
        return example;
    }
    async deleteDesignExample(id) {
        await getDb().delete(designExamples).where(eq(designExamples.id, id));
    }
    // Product Packages
    async getAllProductPackages(filters) {
        let query = getDb().select().from(productPackages);
        const conditions = [];
        if (filters?.roomType) {
            conditions.push(eq(productPackages.roomType, filters.roomType));
        }
        if (filters?.active !== undefined) {
            conditions.push(eq(productPackages.active, filters.active));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        return query.orderBy(desc(productPackages.createdAt));
    }
    async getProductPackage(id) {
        const [pkg] = await getDb().select().from(productPackages).where(eq(productPackages.id, id));
        return pkg;
    }
    async createProductPackage(pkgData) {
        const [pkg] = await getDb().insert(productPackages).values(pkgData).returning();
        return pkg;
    }
    async updateProductPackage(id, pkgData) {
        const [pkg] = await db
            .update(productPackages)
            .set({ ...pkgData, updatedAt: new Date() })
            .where(eq(productPackages.id, id))
            .returning();
        return pkg;
    }
    async deleteProductPackage(id) {
        await getDb().delete(productPackages).where(eq(productPackages.id, id));
    }
    // Placement Guidelines
    async getAllPlacementGuidelines(filters) {
        let query = getDb().select().from(placementGuidelines);
        const conditions = [];
        if (filters?.roomType) {
            conditions.push(eq(placementGuidelines.roomType, filters.roomType));
        }
        if (filters?.productCategory) {
            conditions.push(eq(placementGuidelines.productCategory, filters.productCategory));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        return query.orderBy(desc(placementGuidelines.priority), desc(placementGuidelines.createdAt));
    }
    async getPlacementGuideline(id) {
        const [guideline] = await getDb().select().from(placementGuidelines).where(eq(placementGuidelines.id, id));
        return guideline;
    }
    async createPlacementGuideline(guidelineData) {
        const [guideline] = await getDb().insert(placementGuidelines).values(guidelineData).returning();
        return guideline;
    }
    async updatePlacementGuideline(id, guidelineData) {
        const [guideline] = await db
            .update(placementGuidelines)
            .set({ ...guidelineData, updatedAt: new Date() })
            .where(eq(placementGuidelines.id, id))
            .returning();
        return guideline;
    }
    async deletePlacementGuideline(id) {
        await getDb().delete(placementGuidelines).where(eq(placementGuidelines.id, id));
    }
    // Design Rules
    async getAllDesignRules(filters) {
        let query = getDb().select().from(designRules);
        const conditions = [];
        if (filters?.category) {
            conditions.push(eq(designRules.category, filters.category));
        }
        if (filters?.active !== undefined) {
            conditions.push(eq(designRules.active, filters.active));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        return query.orderBy(desc(designRules.priority), desc(designRules.createdAt));
    }
    async getDesignRule(id) {
        const [rule] = await getDb().select().from(designRules).where(eq(designRules.id, id));
        return rule;
    }
    async createDesignRule(ruleData) {
        const [rule] = await getDb().insert(designRules).values(ruleData).returning();
        return rule;
    }
    async updateDesignRule(id, ruleData) {
        const [rule] = await db
            .update(designRules)
            .set({ ...ruleData, updatedAt: new Date() })
            .where(eq(designRules.id, id))
            .returning();
        return rule;
    }
    async deleteDesignRule(id) {
        await getDb().delete(designRules).where(eq(designRules.id, id));
    }
    // Upload Job operations
    async createUploadJob(jobData) {
        const [job] = await getDb().insert(uploadJobs).values(jobData).returning();
        return job;
    }
    async getUploadJob(id) {
        const [job] = await getDb().select().from(uploadJobs).where(eq(uploadJobs.id, id));
        return job;
    }
    async getUploadJobsByProduct(productId) {
        return getDb().select().from(uploadJobs).where(eq(uploadJobs.productId, productId)).orderBy(desc(uploadJobs.createdAt));
    }
    async getActiveUploadJobs(userId) {
        // Include completed/failed jobs from the last 5 minutes to show final status
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const conditions = [
            or(inArray(uploadJobs.status, ["pending", "processing"]), and(inArray(uploadJobs.status, ["completed", "failed"]), sql `${uploadJobs.completedAt} > ${fiveMinutesAgo}`))
        ];
        if (userId) {
            conditions.push(eq(uploadJobs.userId, userId));
        }
        return getDb().select().from(uploadJobs).where(and(...conditions)).orderBy(desc(uploadJobs.createdAt));
    }
    async updateUploadJob(id, data) {
        const [job] = await db
            .update(uploadJobs)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(uploadJobs.id, id))
            .returning();
        return job;
    }
    async deleteUploadJob(id) {
        await getDb().delete(uploadJobs).where(eq(uploadJobs.id, id));
    }
    // Upload Job File operations
    async createUploadJobFile(fileData) {
        const [file] = await getDb().insert(uploadJobFiles).values(fileData).returning();
        return file;
    }
    async createUploadJobFiles(filesData) {
        return getDb().insert(uploadJobFiles).values(filesData).returning();
    }
    async getUploadJobFiles(jobId) {
        return getDb().select().from(uploadJobFiles).where(eq(uploadJobFiles.jobId, jobId));
    }
    async getPendingUploadJobFiles(jobId) {
        return getDb().select().from(uploadJobFiles).where(and(eq(uploadJobFiles.jobId, jobId), inArray(uploadJobFiles.status, ["pending", "failed"])));
    }
    async updateUploadJobFile(id, data) {
        const [file] = await db
            .update(uploadJobFiles)
            .set(data)
            .where(eq(uploadJobFiles.id, id))
            .returning();
        return file;
    }
    async deleteUploadJobFile(id) {
        await getDb().delete(uploadJobFiles).where(eq(uploadJobFiles.id, id));
    }
    // Visual Analysis Job operations
    async createVisualAnalysisJob(jobData) {
        const [job] = await getDb().insert(visualAnalysisJobs).values(jobData).returning();
        return job;
    }
    async getVisualAnalysisJob(id) {
        const [job] = await getDb().select().from(visualAnalysisJobs).where(eq(visualAnalysisJobs.id, id));
        return job;
    }
    async getActiveVisualAnalysisJobs(userId) {
        const conditions = [inArray(visualAnalysisJobs.status, ["pending", "processing"])];
        if (userId) {
            conditions.push(eq(visualAnalysisJobs.userId, userId));
        }
        return getDb().select().from(visualAnalysisJobs).where(and(...conditions)).orderBy(desc(visualAnalysisJobs.createdAt));
    }
    async updateVisualAnalysisJob(id, data) {
        const [job] = await db
            .update(visualAnalysisJobs)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(visualAnalysisJobs.id, id))
            .returning();
        return job;
    }
    async deleteVisualAnalysisJob(id) {
        await getDb().delete(visualAnalysisJobs).where(eq(visualAnalysisJobs.id, id));
    }
    // Visual Analysis Product operations
    async createVisualAnalysisProduct(productData) {
        const [product] = await getDb().insert(visualAnalysisProducts).values(productData).returning();
        return product;
    }
    async createVisualAnalysisProducts(productsData) {
        if (productsData.length === 0)
            return [];
        return getDb().insert(visualAnalysisProducts).values(productsData).returning();
    }
    async getVisualAnalysisProducts(jobId) {
        return getDb().select().from(visualAnalysisProducts).where(eq(visualAnalysisProducts.jobId, jobId));
    }
    async getPendingVisualAnalysisProducts(jobId, limit) {
        return db
            .select()
            .from(visualAnalysisProducts)
            .where(and(eq(visualAnalysisProducts.jobId, jobId), eq(visualAnalysisProducts.status, "pending")))
            .limit(limit);
    }
    async updateVisualAnalysisProduct(id, data) {
        const [product] = await db
            .update(visualAnalysisProducts)
            .set(data)
            .where(eq(visualAnalysisProducts.id, id))
            .returning();
        return product;
    }
    async deleteVisualAnalysisProduct(id) {
        await getDb().delete(visualAnalysisProducts).where(eq(visualAnalysisProducts.id, id));
    }
    async upsertVisualAnalysisProducts(productsData) {
        if (productsData.length === 0)
            return;
        // Use transaction for batch upsert
        await getDb().transaction(async (tx) => {
            for (const product of productsData) {
                await tx
                    .insert(visualAnalysisProducts)
                    .values(product)
                    .onConflictDoUpdate({
                    target: [visualAnalysisProducts.jobId, visualAnalysisProducts.productId],
                    set: {
                        status: product.status,
                        productSku: product.productSku,
                        productName: product.productName,
                    },
                });
            }
        });
    }
    // S3 Renaming Job operations
    async createS3RenamingJob(jobData) {
        const [job] = await getDb().insert(s3RenamingJobs).values(jobData).returning();
        return job;
    }
    async getS3RenamingJob(id) {
        const [job] = await getDb().select().from(s3RenamingJobs).where(eq(s3RenamingJobs.id, id));
        return job;
    }
    async getActiveS3RenamingJobs(userId) {
        const conditions = [or(eq(s3RenamingJobs.status, 'pending'), eq(s3RenamingJobs.status, 'processing'))];
        if (userId) {
            conditions.push(eq(s3RenamingJobs.userId, userId));
        }
        return getDb().select().from(s3RenamingJobs).where(and(...conditions));
    }
    async updateS3RenamingJob(id, data) {
        const [job] = await db
            .update(s3RenamingJobs)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(s3RenamingJobs.id, id))
            .returning();
        return job;
    }
    async deleteS3RenamingJob(id) {
        await getDb().delete(s3RenamingJobs).where(eq(s3RenamingJobs.id, id));
    }
    // S3 Renaming Product operations
    async createS3RenamingProduct(productData) {
        const [product] = await getDb().insert(s3RenamingProducts).values(productData).returning();
        return product;
    }
    async createS3RenamingProducts(productsData) {
        if (productsData.length === 0)
            return [];
        return getDb().insert(s3RenamingProducts).values(productsData).returning();
    }
    async getS3RenamingProducts(jobId) {
        return getDb().select().from(s3RenamingProducts).where(eq(s3RenamingProducts.jobId, jobId));
    }
    async getPendingS3RenamingProducts(jobId, limit) {
        return db
            .select()
            .from(s3RenamingProducts)
            .where(and(eq(s3RenamingProducts.jobId, jobId), eq(s3RenamingProducts.status, "pending")))
            .limit(limit);
    }
    async updateS3RenamingProduct(id, data) {
        const [product] = await db
            .update(s3RenamingProducts)
            .set(data)
            .where(eq(s3RenamingProducts.id, id))
            .returning();
        return product;
    }
    async deleteS3RenamingProduct(id) {
        await getDb().delete(s3RenamingProducts).where(eq(s3RenamingProducts.id, id));
    }
    // Visual Description Job operations
    async createVisualDescriptionJob(jobData) {
        const [job] = await getDb().insert(visualDescriptionJobs).values(jobData).returning();
        return job;
    }
    async getVisualDescriptionJob(id) {
        const [job] = await getDb().select().from(visualDescriptionJobs).where(eq(visualDescriptionJobs.id, id));
        return job;
    }
    async getActiveVisualDescriptionJobs(userId) {
        const conditions = [or(eq(visualDescriptionJobs.status, 'pending'), eq(visualDescriptionJobs.status, 'processing'))];
        if (userId) {
            conditions.push(eq(visualDescriptionJobs.userId, userId));
        }
        return getDb().select().from(visualDescriptionJobs).where(and(...conditions));
    }
    async updateVisualDescriptionJob(id, data) {
        const [job] = await db
            .update(visualDescriptionJobs)
            .set(data)
            .where(eq(visualDescriptionJobs.id, id))
            .returning();
        return job;
    }
    async deleteVisualDescriptionJob(id) {
        await getDb().delete(visualDescriptionJobs).where(eq(visualDescriptionJobs.id, id));
    }
    // Visual Description Product operations
    async createVisualDescriptionProduct(productData) {
        const [product] = await getDb().insert(visualDescriptionProducts).values(productData).returning();
        return product;
    }
    async createVisualDescriptionProducts(productsData) {
        if (productsData.length === 0)
            return [];
        return getDb().insert(visualDescriptionProducts).values(productsData).returning();
    }
    async getVisualDescriptionProducts(jobId) {
        return getDb().select().from(visualDescriptionProducts).where(eq(visualDescriptionProducts.jobId, jobId));
    }
    async getPendingVisualDescriptionProducts(jobId, limit) {
        if (limit > 10000)
            limit = 10000; // Safety cap
        return db
            .select()
            .from(visualDescriptionProducts)
            .where(and(eq(visualDescriptionProducts.jobId, jobId), eq(visualDescriptionProducts.status, "pending")))
            .limit(limit);
    }
    async updateVisualDescriptionProduct(id, data) {
        const [product] = await db
            .update(visualDescriptionProducts)
            .set(data)
            .where(eq(visualDescriptionProducts.id, id))
            .returning();
        return product;
    }
    async deleteVisualDescriptionProduct(id) {
        await getDb().delete(visualDescriptionProducts).where(eq(visualDescriptionProducts.id, id));
    }
    // Render Products operations
    async createRenderProduct(productData) {
        const [product] = await getDb().insert(renderProducts).values(productData).returning();
        return product;
    }
    async createRenderProducts(productsData) {
        if (productsData.length === 0)
            return [];
        return getDb().insert(renderProducts).values(productsData).returning();
    }
    async getRenderProductsByRender(renderId) {
        return getDb().select().from(renderProducts).where(eq(renderProducts.renderId, renderId));
    }
    async getRenderProduct(id) {
        const [product] = await getDb().select().from(renderProducts).where(eq(renderProducts.id, id));
        return product;
    }
    async deleteRenderProductsByRender(renderId) {
        await getDb().delete(renderProducts).where(eq(renderProducts.renderId, renderId));
    }
    async ingestRenderSnapshot(renderId, productsData, eventsData) {
        await getDb().transaction(async (tx) => {
            await tx.delete(renderProducts).where(eq(renderProducts.renderId, renderId));
            await tx.delete(renderEvents).where(eq(renderEvents.renderId, renderId));
            if (productsData.length > 0) {
                await tx.insert(renderProducts).values(productsData);
            }
            if (eventsData.length > 0) {
                await tx.insert(renderEvents).values(eventsData);
            }
        });
    }
    // Render Events operations
    async createRenderEvent(eventData) {
        const [event] = await getDb().insert(renderEvents).values(eventData).returning();
        return event;
    }
    async getRenderEventsByRender(renderId) {
        return getDb().select().from(renderEvents).where(eq(renderEvents.renderId, renderId)).orderBy(desc(renderEvents.occurredAt));
    }
    async getRenderEventsByType(renderId, eventType) {
        return db
            .select()
            .from(renderEvents)
            .where(and(eq(renderEvents.renderId, renderId), eq(renderEvents.eventType, eventType)))
            .orderBy(desc(renderEvents.occurredAt));
    }
    // Documentation Sections operations
    async getAllDocumentationSections(filters) {
        const conditions = [];
        if (filters?.status) {
            conditions.push(eq(documentationSections.status, filters.status));
        }
        if (filters?.slug) {
            conditions.push(eq(documentationSections.slug, filters.slug));
        }
        if (conditions.length === 0) {
            return getDb().select().from(documentationSections).orderBy(documentationSections.sortOrder);
        }
        return getDb().select().from(documentationSections).where(and(...conditions)).orderBy(documentationSections.sortOrder);
    }
    async getDocumentationSection(id) {
        const [section] = await getDb().select().from(documentationSections).where(eq(documentationSections.id, id));
        return section;
    }
    async getDocumentationSectionBySlug(slug, version) {
        const conditions = [eq(documentationSections.slug, slug)];
        if (version !== undefined) {
            conditions.push(eq(documentationSections.version, version));
        }
        const [section] = await db
            .select()
            .from(documentationSections)
            .where(and(...conditions))
            .orderBy(desc(documentationSections.version))
            .limit(1);
        return section;
    }
    async createDocumentationSection(sectionData) {
        const [section] = await getDb().insert(documentationSections).values(sectionData).returning();
        return section;
    }
    async updateDocumentationSection(id, sectionData) {
        const [section] = await db
            .update(documentationSections)
            .set({ ...sectionData, updatedAt: new Date() })
            .where(eq(documentationSections.id, id))
            .returning();
        return section;
    }
    async deleteDocumentationSection(id) {
        await getDb().delete(documentationSections).where(eq(documentationSections.id, id));
    }
    async publishDocumentationSection(id) {
        const section = await this.getDocumentationSection(id);
        if (!section) {
            throw new Error('Section not found');
        }
        const [updated] = await db
            .update(documentationSections)
            .set({
            status: 'published',
            publishedVersion: section.version,
            updatedAt: new Date(),
        })
            .where(eq(documentationSections.id, id))
            .returning();
        return updated;
    }
    // Documentation Comments operations
    async getCommentsBySection(sectionId, filters) {
        const conditions = [eq(documentationComments.sectionId, sectionId)];
        if (filters?.resolved !== undefined) {
            if (filters.resolved) {
                conditions.push(isNotNull(documentationComments.resolvedAt));
            }
            else {
                conditions.push(isNull(documentationComments.resolvedAt));
            }
        }
        if (filters?.isInternal !== undefined) {
            conditions.push(eq(documentationComments.isInternal, filters.isInternal));
        }
        return db
            .select()
            .from(documentationComments)
            .where(and(...conditions))
            .orderBy(desc(documentationComments.createdAt));
    }
    async getComment(id) {
        const [comment] = await getDb().select().from(documentationComments).where(eq(documentationComments.id, id));
        return comment;
    }
    async createComment(commentData) {
        const [comment] = await getDb().insert(documentationComments).values(commentData).returning();
        return comment;
    }
    async updateComment(id, commentData) {
        const [comment] = await db
            .update(documentationComments)
            .set({ ...commentData, editedAt: new Date() })
            .where(eq(documentationComments.id, id))
            .returning();
        return comment;
    }
    async deleteComment(id) {
        await getDb().delete(documentationComments).where(eq(documentationComments.id, id));
    }
    async resolveComment(id, userId) {
        const [comment] = await db
            .update(documentationComments)
            .set({
            resolvedAt: new Date(),
            resolvedBy: userId,
        })
            .where(eq(documentationComments.id, id))
            .returning();
        return comment;
    }
}
export const curalinaStorage = new CuralinaStorage();
//# sourceMappingURL=storage-curalina.js.map