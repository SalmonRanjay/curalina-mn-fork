import { db } from '../server/db';
import { suppliers, categories, users, products } from '../shared/schema';
import { writeFileSync } from 'fs';

function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'NULL';
    const escaped = value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(',');
    return `ARRAY[${value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]::text[]`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function exportData() {
  console.log('Exporting development database to SQL file...\n');
  
  let sql = `-- CURALINA AI - Development to Production Export
-- Generated: ${new Date().toISOString()}
-- Run this in your Production database via the Database pane

`;

  // Export suppliers
  console.log('Exporting suppliers...');
  const allSuppliers = await db.select().from(suppliers);
  sql += `\n-- SUPPLIERS (${allSuppliers.length} records)\n`;
  for (const s of allSuppliers) {
    sql += `INSERT INTO suppliers (id, name, email) VALUES (${escapeSQL(s.id)}, ${escapeSQL(s.name)}, ${escapeSQL(s.email)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`  ✓ ${allSuppliers.length} suppliers`);

  // Export categories
  console.log('Exporting categories...');
  const allCategories = await db.select().from(categories);
  sql += `\n-- CATEGORIES (${allCategories.length} records)\n`;
  for (const c of allCategories) {
    sql += `INSERT INTO categories (id, name, type, slug) VALUES (${escapeSQL(c.id)}, ${escapeSQL(c.name)}, ${escapeSQL(c.type)}, ${escapeSQL(c.slug)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`  ✓ ${allCategories.length} categories`);

  // Export users
  console.log('Exporting users...');
  const allUsers = await db.select().from(users);
  sql += `\n-- USERS (${allUsers.length} records)\n`;
  for (const u of allUsers) {
    sql += `INSERT INTO users (id, email, password, role, first_name, last_name, phone_number, created_at) VALUES (${escapeSQL(u.id)}, ${escapeSQL(u.email)}, ${escapeSQL(u.password)}, ${escapeSQL(u.role)}, ${escapeSQL(u.firstName)}, ${escapeSQL(u.lastName)}, ${escapeSQL(u.phoneNumber)}, ${escapeSQL(u.createdAt?.toISOString())}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`  ✓ ${allUsers.length} users`);

  // Export products
  console.log('Exporting products...');
  const allProducts = await db.select().from(products);
  sql += `\n-- PRODUCTS (${allProducts.length} records)\n`;
  
  for (const p of allProducts) {
    const cols = [
      'id', 'sku', 'name', 'description', 'category_id', 'supplier_id',
      'trade_price', 'price', 'discount', 'room_type', 'design_style',
      'style_tags', 'key_features', 'storage_solutions', 'colors', 'materials',
      'dimensions', 'weight', 'seating', 'assembly', 'inventory', 'lead_time',
      'availability', 'shipping', 'images', 'asset_3d_url', 'visual_description',
      'image_analyses', 'structured_analysis', 'visual_description_gemini',
      'visual_description_front_view', 'visual_description_front_view_gemini',
      'synthesized_front_view', 'complete_product_description',
      'structured_analysis_quality', 'structured_analysis_updated_at',
      'tags', 'source_file', 'seo_meta', 'slug', 'image_health',
      'last_validated_at', 'created_at'
    ];
    
    const vals = [
      escapeSQL(p.id),
      escapeSQL(p.sku),
      escapeSQL(p.name),
      escapeSQL(p.description),
      escapeSQL(p.categoryId),
      escapeSQL(p.supplierId),
      escapeSQL(p.tradePrice),
      escapeSQL(p.price),
      escapeSQL(p.discount),
      escapeSQL(p.roomType),
      escapeSQL(p.designStyle),
      escapeSQL(p.styleTags),
      escapeSQL(p.keyFeatures),
      escapeSQL(p.storageSolutions),
      escapeSQL(p.colors),
      escapeSQL(p.materials),
      escapeSQL(p.dimensions),
      escapeSQL(p.weight),
      escapeSQL(p.seating),
      escapeSQL(p.assembly),
      escapeSQL(p.inventory),
      escapeSQL(p.leadTime),
      escapeSQL(p.availability),
      escapeSQL(p.shipping),
      escapeSQL(p.images),
      escapeSQL(p.asset3dUrl),
      escapeSQL(p.visualDescription),
      escapeSQL(p.imageAnalyses),
      escapeSQL(p.structuredAnalysis),
      escapeSQL(p.visualDescriptionGemini),
      escapeSQL(p.visualDescriptionFrontView),
      escapeSQL(p.visualDescriptionFrontViewGemini),
      escapeSQL(p.synthesizedFrontView),
      escapeSQL(p.completeProductDescription),
      escapeSQL(p.structuredAnalysisQuality),
      escapeSQL(p.structuredAnalysisUpdatedAt?.toISOString()),
      escapeSQL(p.tags),
      escapeSQL(p.sourceFile),
      escapeSQL(p.seoMeta),
      escapeSQL(p.slug),
      escapeSQL(p.imageHealth),
      escapeSQL(p.lastValidatedAt?.toISOString()),
      escapeSQL(p.createdAt?.toISOString())
    ];
    
    sql += `INSERT INTO products (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  console.log(`  ✓ ${allProducts.length} products`);

  // Write to file
  const outputPath = 'scripts/export-to-production.sql';
  writeFileSync(outputPath, sql);
  console.log(`\n✅ Export complete! File saved to: ${outputPath}`);
  console.log(`   Total size: ${(sql.length / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nTo import to production:');
  console.log('1. Open the Database pane in Replit');
  console.log('2. Switch to Production database');
  console.log('3. Copy and paste the SQL from the file');
  
  process.exit(0);
}

exportData().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
