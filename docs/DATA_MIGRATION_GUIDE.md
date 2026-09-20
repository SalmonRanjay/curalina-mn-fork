# Data Migration Guide: Development to Production

This guide will help you move your development data to production without losing anything.

## Overview

Your Replit project now has:
- ✅ Development database (local/testing)
- ✅ Production database (newly created)

## Step 1: Push Database Schema to Production

First, ensure your production database has the correct schema:

```bash
npm run db:push
```

This command will:
- Read your schema from `shared/schema.ts`
- Apply all table structures to your production database
- Create indexes and relationships

**Note:** You may see a warning about data loss if the schema differs from what's currently in production. Since this is a new production database, you can safely proceed.

If you get a data-loss warning, use:
```bash
npm run db:push --force
```

## Step 2: Export Development Data

You have two options for exporting data:

### Option A: Using PostgreSQL Tools (Recommended)

If you have access to your development database connection details:

```bash
# Export all data to a SQL file
pg_dump $DEV_DATABASE_URL > dev_data_export.sql

# Or export specific tables:
pg_dump $DEV_DATABASE_URL \
  -t categories \
  -t suppliers \
  -t products \
  -t quiz_responses \
  -t renders \
  > dev_data_export.sql
```

### Option B: Using Drizzle ORM Script

Create a script to export data programmatically:

```typescript
// scripts/export-data.ts
import { db } from './server/db';
import * as schema from './shared/schema';
import fs from 'fs';

async function exportData() {
  const data = {
    categories: await db.select().from(schema.categories),
    suppliers: await db.select().from(schema.suppliers),
    products: await db.select().from(schema.products),
    quizResponses: await db.select().from(schema.quizResponses),
    renders: await db.select().from(schema.renders),
    // Add other tables as needed
  };
  
  fs.writeFileSync('dev_data_export.json', JSON.stringify(data, null, 2));
  console.log('Data exported to dev_data_export.json');
}

exportData();
```

## Step 3: Import Data to Production

### Option A: Using PostgreSQL Tools

```bash
# Import the SQL file to production
psql $DATABASE_URL < dev_data_export.sql
```

### Option B: Using Drizzle ORM Script

```typescript
// scripts/import-data.ts
import { db } from './server/db';
import * as schema from './shared/schema';
import fs from 'fs';

async function importData() {
  const data = JSON.parse(fs.readFileSync('dev_data_export.json', 'utf-8'));
  
  // Import in the correct order (respecting foreign keys)
  await db.insert(schema.categories).values(data.categories);
  await db.insert(schema.suppliers).values(data.suppliers);
  await db.insert(schema.products).values(data.products);
  await db.insert(schema.quizResponses).values(data.quizResponses);
  await db.insert(schema.renders).values(data.renders);
  // Add other tables as needed
  
  console.log('Data imported successfully!');
}

importData();
```

## Step 4: Verify Migration

After importing, verify your data:

1. Check table counts:
```sql
SELECT 
  (SELECT COUNT(*) FROM categories) as categories_count,
  (SELECT COUNT(*) FROM suppliers) as suppliers_count,
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM renders) as renders_count;
```

2. Spot-check a few records:
```sql
SELECT * FROM products LIMIT 5;
SELECT * FROM renders LIMIT 5;
```

## Important Notes

### Foreign Key Dependencies

Import tables in this order to respect foreign key constraints:

1. `users` (if using auth)
2. `categories`
3. `suppliers`
4. `products` (depends on categories & suppliers)
5. `quiz_responses`
6. `renders` (depends on quiz_responses)
7. `cart_items` (depends on products)
8. `orders`
9. `order_items` (depends on orders & products)

### Environment Variables

- Development uses: Local/dev DATABASE_URL
- Production uses: Production DATABASE_URL (automatically set by Replit)
- When you publish your app, it will automatically use the production database

### Object Storage (if applicable)

If your renders reference images stored in object storage:
- Make sure object storage is set up in production
- Update image URLs if they reference dev-specific storage

## Troubleshooting

### "Duplicate key" errors
If you get duplicate key errors during import, your production database may already have some data. Clear it first:

```sql
TRUNCATE TABLE products, categories, suppliers, renders, quiz_responses CASCADE;
```

### Performance issues
For large datasets (>10,000 records), consider:
- Importing in batches
- Temporarily disabling indexes during import
- Using COPY commands instead of INSERT

### Missing data
If some data doesn't appear after migration:
- Check the import logs for errors
- Verify foreign key constraints were satisfied
- Ensure all dependent tables were imported

## Next Steps

After successful migration:
1. Test your application thoroughly
2. Verify all features work with production data
3. Consider setting up automated backups
4. Document any production-specific configurations

---

For questions or issues, check the Replit Database documentation or PostgreSQL guides.
