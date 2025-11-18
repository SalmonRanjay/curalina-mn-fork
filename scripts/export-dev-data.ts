import { db } from '../server/db';
import * as schema from '../shared/schema';
import fs from 'fs';
import path from 'path';

async function exportDevData() {
  console.log('📦 Exporting development data...');
  
  try {
    // Export data in the correct order (respecting foreign keys)
    const data = {
      users: await db.select().from(schema.users),
      categories: await db.select().from(schema.categories),
      suppliers: await db.select().from(schema.suppliers),
      products: await db.select().from(schema.products),
      quizResponses: await db.select().from(schema.quizResponses),
      renders: await db.select().from(schema.renders),
      renderProducts: await db.select().from(schema.renderProducts),
      renderEvents: await db.select().from(schema.renderEvents),
      selectionLedger: await db.select().from(schema.selectionLedger),
      cartItems: await db.select().from(schema.cartItems),
      orders: await db.select().from(schema.orders),
      orderItems: await db.select().from(schema.orderItems),
      content: await db.select().from(schema.content),
      settings: await db.select().from(schema.settings),
      activityLog: await db.select().from(schema.activityLog),
      designExamples: await db.select().from(schema.designExamples),
      productPackages: await db.select().from(schema.productPackages),
      placementGuidelines: await db.select().from(schema.placementGuidelines),
      designRules: await db.select().from(schema.designRules),
    };

    // Create scripts directory if it doesn't exist
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Save to file
    const filename = path.join(scriptsDir, 'dev-data-export.json');
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));

    console.log('\n✅ Export complete!');
    console.log(`📁 Data saved to: ${filename}`);
    console.log('\n📊 Export Summary:');
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Categories: ${data.categories.length}`);
    console.log(`   Suppliers: ${data.suppliers.length}`);
    console.log(`   Products: ${data.products.length}`);
    console.log(`   Quiz Responses: ${data.quizResponses.length}`);
    console.log(`   Renders: ${data.renders.length}`);
    console.log(`   Cart Items: ${data.cartItems.length}`);
    console.log(`   Orders: ${data.orders.length}`);
    console.log(`   Content: ${data.content.length}`);
    console.log(`   Design Examples: ${data.designExamples.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportDevData();
