import { readFileSync } from 'fs';
import { read, utils } from 'xlsx';
import { db } from '../server/db';
import { products, categories, suppliers } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function importProducts() {
  try {
    const fileBuffer = readFileSync('attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762332689675.xlsx');
    const workbook = read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = utils.sheet_to_json(worksheet);

    console.log('Total rows:', data.length);
    console.log('Sample row:', data[0]);
    console.log('Column headers:', Object.keys(data[0] || {}));

    let imported = 0;
    let skipped = 0;

    for (const row of data as any[]) {
      try {
        // Get or create category (using Furniture Category field)
        const categoryName = row['Furniture Category'] || 'Furniture';
        const firstCategory = categoryName.split(',')[0].trim();
        let category = await db.select().from(categories).where(eq(categories.name, firstCategory)).limit(1);
        
        if (category.length === 0) {
          const [newCategory] = await db.insert(categories).values({
            name: firstCategory,
            type: 'furniture',
            slug: firstCategory.toLowerCase().replace(/\s+/g, '-'),
          }).returning();
          category = [newCategory];
        }

        // Get or create supplier
        const supplierName = row.Supplier || 'Unknown Supplier';
        let supplier = await db.select().from(suppliers).where(eq(suppliers.name, supplierName)).limit(1);
        
        if (supplier.length === 0) {
          const [newSupplier] = await db.insert(suppliers).values({
            name: supplierName,
            email: `${supplierName.toLowerCase().replace(/\s+/g, '')}@supplier.com`,
          }).returning();
          supplier = [newSupplier];
        }

        // Check if product already exists by SKU
        const sku = row.SKU || `PRODUCT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const existingProduct = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
        
        if (existingProduct.length > 0) {
          skipped++;
          continue;
        }

        // Parse retail price
        let price = 0;
        const priceField = row['Retail Price'];
        if (typeof priceField === 'string') {
          price = parseFloat(priceField.replace(/[$,]/g, '')) || 0;
        } else {
          price = Number(priceField) || 0;
        }

        // Parse dimensions from format "20.5" W X 18.5" D X 22.7" H"
        let dimensions = null;
        const dimString = row['General Dimensions (Inch)\r\nWidth x Depth x Height'] || row['General Dimensions (Inch)'];
        if (dimString) {
          const matches = dimString.match(/(\d+\.?\d*)\s*"\s*W\s*X\s*(\d+\.?\d*)\s*"\s*D\s*X\s*(\d+\.?\d*)\s*"\s*H/i);
          if (matches) {
            dimensions = {
              w: parseFloat(matches[1]),
              d: parseFloat(matches[2]),
              h: parseFloat(matches[3]),
              unit: 'inches'
            };
          }
        }

        // Parse colors
        const colorField = row.Colour || row.Color;
        const colorArray = colorField ? colorField.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
        
        // Parse materials
        const materialField = row['Product Material'];
        const materialArray = materialField ? materialField.split(',').map((m: string) => m.trim()).filter(Boolean) : [];
        
        // Parse style tags from Design Style and Tags
        const designStyles = row['Design Style'] || '';
        const tags = row.Tags || '';
        const styleTags = [...new Set([
          ...designStyles.split(',').map((s: string) => s.trim()).filter(Boolean),
          ...tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        ])].slice(0, 10);

        // Insert product
        const productName = row['Product Name'] || 'Unknown Product';
        await db.insert(products).values({
          sku,
          name: productName,
          description: row.Overview || '',
          categoryId: category[0].id,
          supplierId: supplier[0].id,
          styleTags,
          colors: colorArray,
          materials: materialArray,
          dimensions,
          price,
          discount: 0,
          availability: (row.Inventory && Number(row.Inventory) > 0) ? 'in_stock' : 'preorder',
          images: [],
          asset3dUrl: null,
          shipping: { cost: 0, eta: row['LEAD Time'] ? `${row['LEAD Time']} days` : '5-7 business days' },
          seoMeta: { 
            title: productName, 
            description: row.Overview ? row.Overview.substring(0, 160) : '' 
          },
          slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        });

        imported++;
        if (imported % 10 === 0) {
          console.log(`✓ Imported ${imported} products...`);
        }

      } catch (error) {
        console.error('Error importing row:', error);
        skipped++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported} products`);
    console.log(`   Skipped: ${skipped} products`);

  } catch (error) {
    console.error('Error reading Excel file:', error);
    throw error;
  }
}

importProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
