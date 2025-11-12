# Database Sync Guide: Production to Development

This guide explains how to safely copy production data to your development database for testing purposes.

## Prerequisites

- Production database connection string (`PRODUCTION_DATABASE_URL`)
- Development database connection string (`DATABASE_URL`)
- Access to both databases

## Option 1: Using Neon Dashboard (Recommended)

Neon provides built-in backup and restore functionality:

1. **Create a backup in production:**
   - Go to your Neon dashboard for the production database
   - Navigate to "Backups" tab
   - Click "Create backup" to create a point-in-time backup

2. **Restore to development:**
   - Create a new branch from the backup
   - Update your `DATABASE_URL` to point to this branch
   - Or download the backup and restore it to your dev database

## Option 2: Manual Export/Import

### Step 1: Export Production Data

```bash
# Export entire database
pg_dump $PRODUCTION_DATABASE_URL > prod_backup.sql

# Export specific tables only (safer)
pg_dump $PRODUCTION_DATABASE_URL \
  -t categories \
  -t suppliers \
  -t products \
  -t design_examples \
  -t product_packages \
  -t placement_guidelines \
  -t design_rules \
  > prod_safe_data.sql
```

### Step 2: Sanitize Sensitive Data

Create a sanitization script `sanitize.sql`:

```sql
-- Anonymize user emails
UPDATE users SET 
  email = CONCAT('user', id, '@example.com'),
  name = CONCAT('User ', SUBSTRING(id, 1, 8));

-- Clear session data
TRUNCATE TABLE session;

-- Clear cart items (they're session-specific)
TRUNCATE TABLE cart_items;

-- Anonymize order customer info
UPDATE orders SET 
  customer_email = 'customer@example.com',
  customer_first_name = 'John',
  customer_last_name = 'Doe';

-- Remove any API keys from metadata
UPDATE products SET 
  metadata = jsonb_set(metadata, '{apiKey}', '"REDACTED"') 
  WHERE metadata ? 'apiKey';
```

### Step 3: Import to Development

```bash
# Import the backup
psql $DATABASE_URL < prod_safe_data.sql

# Run sanitization
psql $DATABASE_URL < sanitize.sql
```

## Option 3: Selective Data Copy

For testing specific features, you might only need certain tables:

```bash
# Copy only product catalog data (safe, no user data)
pg_dump $PRODUCTION_DATABASE_URL \
  --data-only \
  -t products \
  -t categories \
  -t suppliers \
  | psql $DATABASE_URL
```

## Quick Sync Script

Create a `sync-db.sh` script:

```bash
#!/bin/bash

# Load environment variables
source .env

echo "🔄 Syncing production data to development..."

# Tables to sync (no user data)
TABLES="categories suppliers products design_examples product_packages placement_guidelines design_rules"

# Export from production
echo "📤 Exporting production data..."
pg_dump $PRODUCTION_DATABASE_URL \
  --data-only \
  --no-owner \
  --no-acl \
  $(for t in $TABLES; do echo "-t $t"; done) \
  > temp_prod_data.sql

# Clear dev tables
echo "🗑️ Clearing development tables..."
for TABLE in $TABLES; do
  psql $DATABASE_URL -c "TRUNCATE TABLE $TABLE CASCADE;"
done

# Import to development  
echo "📥 Importing to development..."
psql $DATABASE_URL < temp_prod_data.sql

# Cleanup
rm temp_prod_data.sql

echo "✅ Sync complete!"
```

Make it executable: `chmod +x sync-db.sh`
Run it: `./sync-db.sh`

## Important Notes

### Data to Sync Safely
✅ Safe to sync:
- Products, categories, suppliers
- Design examples and rules
- Product packages
- Placement guidelines

⚠️ Sync with caution (needs sanitization):
- Quiz responses (may contain personal preferences)
- Renders (linked to user sessions)
- Orders (contains customer info)

❌ Never sync:
- User passwords/sessions
- API keys and secrets
- Payment information
- Active cart items

### Environment Variables

Add to your `.env` file:

```bash
# Development database (already configured)
DATABASE_URL=postgresql://user:pass@host/dev_db

# Production database (for syncing)
PRODUCTION_DATABASE_URL=postgresql://user:pass@host/prod_db
```

### Testing After Sync

After syncing, verify:

1. **Product images load correctly:**
   ```sql
   SELECT COUNT(*) FROM products WHERE images IS NOT NULL;
   ```

2. **Categories are intact:**
   ```sql
   SELECT COUNT(*) FROM categories;
   ```

3. **No sensitive data remains:**
   ```sql
   -- Should return generic emails
   SELECT DISTINCT email FROM users LIMIT 5;
   ```

## Troubleshooting

### Connection Issues
- Ensure your IP is whitelisted in Neon dashboard
- Check connection strings are correct
- Verify database user has appropriate permissions

### Data Integrity
- Always backup your dev database before importing
- Use transactions when possible
- Test on a subset of data first

### Performance
- For large databases, sync only needed tables
- Consider using `--jobs` flag for parallel export/import
- Schedule syncs during off-peak hours

## Automated Sync (Optional)

Add to `package.json`:

```json
"scripts": {
  "db:sync": "bash ./sync-db.sh",
  "db:backup": "pg_dump $DATABASE_URL > backups/dev_$(date +%Y%m%d).sql"
}
```

Then run:
- `npm run db:sync` - Sync production to dev
- `npm run db:backup` - Backup dev database