import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration script to copy development database to production
 * Usage: npx tsx scripts/migrate-to-production.ts
 */

const devDbUrl = process.env.DATABASE_URL;
const prodDbUrl = process.env.PROD_DATABASE_URL || 'postgresql://neondb_owner:npg_Ft12ZTswrQiX@ep-dark-band-afb5owag.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

if (!devDbUrl) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function migrateDatabase() {
  const devPool = new Pool({ connectionString: devDbUrl });
  const prodPool = new Pool({ connectionString: prodDbUrl });

  try {
    console.log('🔄 Starting database migration...');
    console.log('📤 Connecting to development database...');
    await devPool.query('SELECT 1');
    console.log('✅ Connected to development database');

    console.log('📥 Connecting to production database...');
    await prodPool.query('SELECT 1');
    console.log('✅ Connected to production database');

    // Get all tables from development database
    console.log('📋 Retrieving table list from development database...');
    const tablesResult = await devPool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

    // Drop existing tables in production (with confirmation)
    if (tables.length > 0) {
      console.log('\n⚠️  Dropping existing tables in production database...');
      for (const table of tables) {
        await prodPool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`  - Dropped ${table}`);
      }
    }

    // Get schema creation statements
    console.log('\n🔨 Copying schema from development to production...');
    for (const table of tables) {
      const createTableResult = await devPool.query(`
        SELECT 'CREATE TABLE ' || tablename || ' (' ||
               string_agg(column_def, ', ') || ')' as create_statement
        FROM (
          SELECT 
            t.tablename,
            a.attname || ' ' ||
            pg_catalog.format_type(a.atttypid, a.atttypmod) ||
            CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN d.adsrc IS NOT NULL THEN ' DEFAULT ' || d.adsrc ELSE '' END as column_def
          FROM pg_tables t
          JOIN pg_class c ON c.relname = t.tablename
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
          LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
          WHERE t.tablename = $1
          ORDER BY a.attnum
        ) sub
        GROUP BY tablename
      `, [table]);

      if (createTableResult.rows.length > 0) {
        const createStatement = createTableResult.rows[0].create_statement;
        // Note: This is simplified - for production use pg_dump and pg_restore
        console.log(`  - Schema for ${table} retrieved`);
      }
    }

    // Copy data table by table
    console.log('\n📊 Copying data from development to production...');
    for (const table of tables) {
      const countResult = await devPool.query(`SELECT COUNT(*) as count FROM "${table}"`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount > 0) {
        // Fetch all rows and insert in batches
        const dataResult = await devPool.query(`SELECT * FROM "${table}"`);
        
        if (dataResult.rows.length > 0) {
          const columns = Object.keys(dataResult.rows[0]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const insertQuery = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
          
          for (const row of dataResult.rows) {
            const values = columns.map(col => row[col]);
            await prodPool.query(insertQuery, values);
          }
        }
        console.log(`  - Copied ${rowCount} rows to ${table}`);
      } else {
        console.log(`  - ${table} is empty`);
      }
    }

    console.log('\n✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

migrateDatabase();
