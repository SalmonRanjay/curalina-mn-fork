/**
 * Safe Data Sync Utility
 * Copies non-sensitive data from production to development
 * Only syncs product catalog data - no user information
 */
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
// Load environment variables
config();
const DEV_URL = process.env.DATABASE_URL;
const PROD_URL = process.env.PRODUCTION_DATABASE_URL;
if (!DEV_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
}
if (!PROD_URL) {
    console.error('❌ PRODUCTION_DATABASE_URL not configured');
    console.log('Add it to your .env file:');
    console.log('PRODUCTION_DATABASE_URL=postgresql://...');
    process.exit(1);
}
// Ensure we're not accidentally overwriting production
if (DEV_URL === PROD_URL) {
    console.error('❌ Safety check failed: Dev and Prod URLs are the same!');
    process.exit(1);
}
async function syncSafeData() {
    console.log('🔄 Starting safe data sync from production to development...\n');
    const prodSql = neon(PROD_URL);
    const devSql = neon(DEV_URL);
    // Tables that are safe to copy (no user data)
    const safeTables = [
        'categories',
        'suppliers',
        'products',
        'design_examples',
        'product_packages',
        'placement_guidelines',
        'design_rules',
    ];
    console.log('📋 Tables to sync:', safeTables.join(', '));
    console.log('\n⚠️  This will REPLACE data in your development database!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    for (const table of safeTables) {
        try {
            console.log(`\n📦 Syncing ${table}...`);
            // Get count from production
            const prodCount = await prodSql `SELECT COUNT(*) as count FROM ${prodSql(table)}`;
            console.log(`  Production: ${prodCount[0].count} rows`);
            // Get all data from production
            const data = await prodSql `SELECT * FROM ${prodSql(table)}`;
            if (data.length === 0) {
                console.log(`  ⚠️  No data to sync`);
                continue;
            }
            // Clear development table
            await devSql `TRUNCATE TABLE ${devSql(table)} CASCADE`;
            console.log(`  Cleared development table`);
            // Insert in batches of 100 to avoid query size limits
            const batchSize = 100;
            let inserted = 0;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                // Get column names from first row
                const columns = Object.keys(batch[0]);
                const columnList = columns.join(', ');
                // Build values string
                const values = batch.map(row => {
                    const vals = columns.map(col => {
                        const val = row[col];
                        if (val === null)
                            return 'NULL';
                        if (val === undefined)
                            return 'NULL';
                        if (typeof val === 'boolean')
                            return val.toString();
                        if (typeof val === 'number')
                            return val.toString();
                        if (Array.isArray(val)) {
                            // Handle array columns (like images)
                            if (val.length === 0)
                                return 'ARRAY[]::text[]';
                            return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
                        }
                        if (typeof val === 'object') {
                            // Handle JSONB columns
                            return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                        }
                        // String value
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                    return `(${vals.join(', ')})`;
                }).join(', ');
                // Build and execute insert query
                const insertQuery = `INSERT INTO ${table} (${columnList}) VALUES ${values}`;
                await devSql.unsafe(insertQuery);
                inserted += batch.length;
                process.stdout.write(`\r  Inserted ${inserted}/${data.length} rows...`);
            }
            console.log(`\n  ✅ Successfully synced ${inserted} rows`);
        }
        catch (error) {
            console.error(`  ❌ Failed to sync ${table}:`, error.message);
            // Continue with next table even if one fails
        }
    }
    console.log('\n\n✅ Safe data sync complete!');
    console.log('\n📊 Development database now contains:');
    // Show final counts
    for (const table of safeTables) {
        try {
            const count = await devSql `SELECT COUNT(*) as count FROM ${devSql(table)}`;
            console.log(`  ${table}: ${count[0].count} rows`);
        }
        catch {
            console.log(`  ${table}: ❌ Error`);
        }
    }
    console.log('\n💡 Note: User data, sessions, and orders were NOT copied for privacy.');
    console.log('Your development database now has real product data for testing!');
}
// Run the sync
syncSafeData()
    .catch(error => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
})
    .then(() => {
    process.exit(0);
});
//# sourceMappingURL=sync-safe-data.js.map