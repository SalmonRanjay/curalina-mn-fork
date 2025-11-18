import { db } from '../server/db';
import * as schema from '../shared/schema';
import fs from 'fs';
import path from 'path';

// Helper function to convert timestamp strings back to Date objects
function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertTimestamps(item));
  }
  
  const converted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if this looks like a timestamp field
    if ((key.includes('At') || key.includes('at')) && typeof value === 'string') {
      // Try to parse as date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        converted[key] = date;
      } else {
        converted[key] = value;
      }
    } else if (value && typeof value === 'object') {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

async function importToProduction() {
  console.log('📥 Importing data to production...');
  console.log('⚠️  Make sure you have run "npm run db:push --force" first!');
  console.log('');

  try {
    // Read the export file
    const filename = path.join(process.cwd(), 'scripts', 'dev-data-export.json');
    if (!fs.existsSync(filename)) {
      console.error(`❌ Export file not found: ${filename}`);
      console.error('Please run the export script first: tsx scripts/export-dev-data.ts');
      process.exit(1);
    }

    const rawData = JSON.parse(fs.readFileSync(filename, 'utf-8'));
    
    // Convert all timestamp strings to Date objects
    const data = convertTimestamps(rawData);

    console.log('📊 Data to import:');
    console.log(`   Users: ${data.users?.length || 0}`);
    console.log(`   Categories: ${data.categories?.length || 0}`);
    console.log(`   Suppliers: ${data.suppliers?.length || 0}`);
    console.log(`   Products: ${data.products?.length || 0}`);
    console.log(`   Quiz Responses: ${data.quizResponses?.length || 0}`);
    console.log(`   Renders: ${data.renders?.length || 0}`);
    console.log('');

    // Clear production database first (in reverse order of dependencies)
    console.log('🗑️  Clearing production database...');
    await db.delete(schema.designRules);
    await db.delete(schema.placementGuidelines);
    await db.delete(schema.productPackages);
    await db.delete(schema.designExamples);
    await db.delete(schema.activityLog);
    await db.delete(schema.settings);
    await db.delete(schema.content);
    await db.delete(schema.orderItems);
    await db.delete(schema.orders);
    await db.delete(schema.cartItems);
    await db.delete(schema.selectionLedger);
    await db.delete(schema.renderEvents);
    await db.delete(schema.renderProducts);
    await db.delete(schema.renders);
    await db.delete(schema.quizResponses);
    await db.delete(schema.products);
    await db.delete(schema.suppliers);
    await db.delete(schema.categories);
    await db.delete(schema.users);
    console.log('✅ Production database cleared');
    console.log('');

    // Import in the correct order (respecting foreign keys)
    let imported = 0;

    if (data.users?.length > 0) {
      console.log('Importing users...');
      await db.insert(schema.users).values(data.users);
      imported += data.users.length;
    }

    if (data.categories?.length > 0) {
      console.log('Importing categories...');
      await db.insert(schema.categories).values(data.categories);
      imported += data.categories.length;
    }

    if (data.suppliers?.length > 0) {
      console.log('Importing suppliers...');
      await db.insert(schema.suppliers).values(data.suppliers);
      imported += data.suppliers.length;
    }

    if (data.products?.length > 0) {
      console.log('Importing products...');
      await db.insert(schema.products).values(data.products);
      imported += data.products.length;
    }

    if (data.quizResponses?.length > 0) {
      console.log('Importing quiz responses...');
      await db.insert(schema.quizResponses).values(data.quizResponses);
      imported += data.quizResponses.length;
    }

    if (data.renders?.length > 0) {
      console.log('Importing renders...');
      await db.insert(schema.renders).values(data.renders);
      imported += data.renders.length;
    }

    if (data.renderProducts?.length > 0) {
      console.log('Importing render products...');
      await db.insert(schema.renderProducts).values(data.renderProducts);
      imported += data.renderProducts.length;
    }

    if (data.renderEvents?.length > 0) {
      console.log('Importing render events...');
      await db.insert(schema.renderEvents).values(data.renderEvents);
      imported += data.renderEvents.length;
    }

    if (data.selectionLedger?.length > 0) {
      console.log('Importing selection ledger...');
      await db.insert(schema.selectionLedger).values(data.selectionLedger);
      imported += data.selectionLedger.length;
    }

    if (data.cartItems?.length > 0) {
      console.log('Importing cart items...');
      await db.insert(schema.cartItems).values(data.cartItems);
      imported += data.cartItems.length;
    }

    if (data.orders?.length > 0) {
      console.log('Importing orders...');
      await db.insert(schema.orders).values(data.orders);
      imported += data.orders.length;
    }

    if (data.orderItems?.length > 0) {
      console.log('Importing order items...');
      await db.insert(schema.orderItems).values(data.orderItems);
      imported += data.orderItems.length;
    }

    if (data.content?.length > 0) {
      console.log('Importing content...');
      await db.insert(schema.content).values(data.content);
      imported += data.content.length;
    }

    if (data.settings?.length > 0) {
      console.log('Importing settings...');
      await db.insert(schema.settings).values(data.settings);
      imported += data.settings.length;
    }

    if (data.activityLog?.length > 0) {
      console.log('Importing activity log...');
      await db.insert(schema.activityLog).values(data.activityLog);
      imported += data.activityLog.length;
    }

    if (data.designExamples?.length > 0) {
      console.log('Importing design examples...');
      await db.insert(schema.designExamples).values(data.designExamples);
      imported += data.designExamples.length;
    }

    if (data.productPackages?.length > 0) {
      console.log('Importing product packages...');
      await db.insert(schema.productPackages).values(data.productPackages);
      imported += data.productPackages.length;
    }

    if (data.placementGuidelines?.length > 0) {
      console.log('Importing placement guidelines...');
      await db.insert(schema.placementGuidelines).values(data.placementGuidelines);
      imported += data.placementGuidelines.length;
    }

    if (data.designRules?.length > 0) {
      console.log('Importing design rules...');
      await db.insert(schema.designRules).values(data.designRules);
      imported += data.designRules.length;
    }

    console.log('');
    console.log(`✅ Import complete! ${imported} records imported successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('');
    console.error('Common issues:');
    console.error('- Duplicate key errors: Production database may have existing data');
    console.error('- Foreign key errors: Check that dependent tables are imported first');
    console.error('- Schema mismatch: Make sure you ran "npm run db:push --force" first');
    process.exit(1);
  }
}

importToProduction();
