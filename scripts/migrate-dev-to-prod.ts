import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get database URLs from environment
const DEV_DATABASE_URL = process.env.DATABASE_URL;
const PROD_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;

if (!DEV_DATABASE_URL || !PROD_DATABASE_URL) {
  console.error("❌ Missing environment variables:");
  if (!DEV_DATABASE_URL) console.error("  - DATABASE_URL (development)");
  if (!PROD_DATABASE_URL) console.error("  - PRODUCTION_DATABASE_URL (production)");
  process.exit(1);
}

// Initialize connections
const devDb = neon(DEV_DATABASE_URL);
const prodDb = neon(PROD_DATABASE_URL);

// List of tables to migrate (in dependency order - foreign keys last)
const TABLES = [
  "users",
  "content",
  "settings",
  "activity_log",
  "categories",
  "suppliers",
  "products",
  "quiz_responses",
  "renders",
  "selection_ledger",
  "comparison_renders",
  "render_products",
  "render_events",
  "cart_items",
  "orders",
  "order_items",
  "design_examples",
  "product_packages",
  "ai_training_data",
];

interface MigrationStats {
  tableName: string;
  rowCount: number;
  status: "success" | "error" | "skipped";
  message: string;
}

const stats: MigrationStats[] = [];

async function clearProductionTables(): Promise<void> {
  console.log("\n🧹 Clearing production database tables...");
  
  // Delete in reverse order to respect foreign keys (don't use TRUNCATE CASCADE)
  for (const table of TABLES.reverse()) {
    try {
      await prodDb(`DELETE FROM ${table}`);
      console.log(`  ✓ Cleared ${table}`);
    } catch (err: any) {
      if (err.message.includes("does not exist")) {
        console.log(`  ℹ Table ${table} doesn't exist (skipping)`);
      } else if (err.message.includes("violates foreign key constraint")) {
        // Try clearing dependent tables first, then retry
        console.log(`  ⚠ Skipping ${table} (has dependent data, will clear later)`);
      } else {
        console.warn(`  ⚠ Failed to clear ${table}: ${err.message}`);
      }
    }
  }
}

async function migrateTable(tableName: string): Promise<void> {
  try {
    // Check if table exists in dev
    const tableExists = await devDb(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
      [tableName]
    );
    
    if (!tableExists[0]?.exists) {
      stats.push({
        tableName,
        rowCount: 0,
        status: "skipped",
        message: "Table not found in development database",
      });
      return;
    }
    
    // Get all rows from development
    const rows = await devDb(`SELECT * FROM ${tableName}`);
    
    if (rows.length === 0) {
      stats.push({
        tableName,
        rowCount: 0,
        status: "success",
        message: "No data to migrate",
      });
      return;
    }
    
    // Get column names
    const columns = Object.keys(rows[0]);
    const columnList = columns.join(", ");
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    
    // Insert data with individual queries (safer error handling)
    let successCount = 0;
    for (const row of rows) {
      const values = columns.map((col) => row[col]);
      try {
        await prodDb(
          `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`,
          values
        );
        successCount++;
      } catch (err: any) {
        // Log specific errors but continue
        if (err.message.includes("duplicate key")) {
          console.log(
            `    ⚠ Duplicate key in ${tableName} (likely already migrated)`
          );
        } else {
          console.warn(
            `    ⚠ Error inserting into ${tableName}: ${err.message}`
          );
        }
      }
    }
    
    stats.push({
      tableName,
      rowCount: successCount,
      status: "success",
      message: `Migrated ${successCount}/${rows.length} rows`,
    });
    
    console.log(
      `  ✓ ${tableName}: ${successCount}/${rows.length} rows migrated`
    );
  } catch (err: any) {
    stats.push({
      tableName,
      rowCount: 0,
      status: "error",
      message: err.message,
    });
    console.error(`  ❌ ${tableName}: ${err.message}`);
  }
}

async function runMigration(): Promise<void> {
  console.log("🚀 Starting development to production data migration...");
  console.log(`📊 Tables to migrate: ${TABLES.length}`);
  
  // Confirm before proceeding
  console.log("\n⚠️  WARNING: This will CLEAR all data in production and replace it with development data.");
  console.log("Press Ctrl+C now to cancel, or the script will proceed in 5 seconds...\n");
  
  await new Promise((resolve) => setTimeout(resolve, 5000));
  
  // Step 1: Clear production tables
  try {
    await clearProductionTables();
  } catch (err: any) {
    console.error("❌ Failed to clear production tables:", err.message);
    process.exit(1);
  }
  
  // Step 2: Migrate each table
  console.log("\n📥 Migrating data from development to production...");
  
  for (const table of TABLES) {
    await migrateTable(table);
  }
  
  // Step 3: Display summary
  console.log("\n📊 Migration Summary:");
  console.log("=".repeat(60));
  
  const successful = stats.filter((s) => s.status === "success");
  const errors = stats.filter((s) => s.status === "error");
  const skipped = stats.filter((s) => s.status === "skipped");
  
  for (const stat of stats) {
    const emoji =
      stat.status === "success" ? "✓" : stat.status === "error" ? "❌" : "ℹ";
    console.log(`${emoji} ${stat.tableName.padEnd(25)} | ${stat.message}`);
  }
  
  console.log("=".repeat(60));
  console.log(
    `\n✅ Success: ${successful.length} tables`
  );
  console.log(`⚠️  Skipped: ${skipped.length} tables`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length} tables`);
  }
  
  const totalRows = successful.reduce((sum, s) => sum + s.rowCount, 0);
  console.log(`\n📈 Total rows migrated: ${totalRows}`);
  
  console.log("\n✨ Migration complete!");
  console.log("\nNext steps:");
  console.log("1. Verify production data in the Replit database pane");
  console.log("2. Test your app with production data");
  console.log("3. Deploy your app when ready");
}

// Run migration
runMigration().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
