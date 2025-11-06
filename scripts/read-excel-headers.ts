import { readFileSync } from 'fs';
import { read, utils } from 'xlsx';

const filePath = 'attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx';

try {
  const fileBuffer = readFileSync(filePath);
  const workbook = read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(worksheet);

  console.log('=== FILE ANALYSIS ===');
  console.log('Total rows:', data.length);
  console.log('\n=== COLUMN HEADERS ===');
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    headers.forEach((header, index) => {
      console.log(`${index + 1}. ${header}`);
    });
    
    console.log('\n=== SAMPLE ROW (First Product) ===');
    console.log(JSON.stringify(data[0], null, 2));
  }
} catch (error) {
  console.error('Error reading file:', error);
  process.exit(1);
}
