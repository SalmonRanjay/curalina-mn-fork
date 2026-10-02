/**
 * Budget Allocation System Tests
 * 
 * Run with: npx tsx server/services/budget-allocation.test.ts
 */

import {
  budgetRangeToNumeric,
  calculateBudgetAllocation,
  mapProductCategoryToBudgetCategory,
  calculateBudgetFitScore,
  type BudgetAllocation,
  type CategoryBudget
} from './budget-allocation';

// Test 1: Budget Range to Numeric Conversion
console.log('='.repeat(60));
console.log('TEST 1: Budget Range to Numeric Conversion');
console.log('='.repeat(60));

const testRanges = ['budget', 'moderate', 'premium', 'luxury'];
testRanges.forEach(range => {
  const numeric = budgetRangeToNumeric(range);
  console.log(`✓ ${range.padEnd(10)} → $${numeric.toLocaleString()}`);
});

// Test 2: Budget Allocation for Each Room Type
console.log('\n' + '='.repeat(60));
console.log('TEST 2: Budget Allocation by Room Type');
console.log('='.repeat(60));

const roomTypes = ['Living Room', 'Bedroom', 'Dining Room', 'Home Office'];
roomTypes.forEach(roomType => {
  console.log(`\n${roomType} (Moderate Budget: $15,000):`);
  console.log('-'.repeat(60));
  
  const allocation = calculateBudgetAllocation(roomType, 'moderate');
  
  console.log(`Total Budget: $${allocation.totalBudget.toLocaleString()}`);
  console.log(`Flexible Pool: $${allocation.flexiblePool.toLocaleString()}\n`);
  
  console.log('Category Allocations:');
  allocation.categoryBudgets.forEach(cb => {
    const allocated = cb.allocatedBudget.toLocaleString();
    const priority = cb.priority.padEnd(10);
    console.log(`  ${cb.category.padEnd(20)} ${priority} $${allocated}`);
  });
  
  // Verify total allocation equals total budget
  const sum = allocation.categoryBudgets.reduce((s, cb) => s + cb.allocatedBudget, 0) 
              + allocation.flexiblePool;
  const diff = Math.abs(sum - allocation.totalBudget);
  if (diff < 0.01) {
    console.log(`\n✓ Budget allocation balanced (diff: $${diff.toFixed(2)})`);
  } else {
    console.error(`\n✗ Budget allocation mismatch! Sum: $${sum.toFixed(2)}, Expected: $${allocation.totalBudget}`);
  }
});

// Test 3: Category Mapping
console.log('\n' + '='.repeat(60));
console.log('TEST 3: Product Category to Budget Category Mapping');
console.log('='.repeat(60));

const testCategoryMappings = [
  { productCat: 'Sofa', roomType: 'Living Room', expected: 'Seating' },
  { productCat: 'Dining Table', roomType: 'Dining Room', expected: 'Dining Table' },
  { productCat: 'Office Chair', roomType: 'Home Office', expected: 'Seating' },
  { productCat: 'Bed Frame', roomType: 'Bedroom', expected: 'Bed' },
  { productCat: 'Dresser', roomType: 'Bedroom', expected: 'Storage' },
  { productCat: 'Coffee Table', roomType: 'Living Room', expected: 'Tables' },
  { productCat: 'Accent Chair', roomType: 'Living Room', expected: 'Accent Chair' },
  { productCat: 'Rug', roomType: 'Living Room', expected: 'Rug' },
];

testCategoryMappings.forEach(test => {
  const mapped = mapProductCategoryToBudgetCategory(test.productCat, test.roomType);
  const status = mapped === test.expected ? '✓' : '✗';
  console.log(`${status} ${test.productCat.padEnd(20)} → ${mapped || 'null'} ${mapped === test.expected ? '' : `(expected: ${test.expected})`}`);
});

// Test 4: Budget Fit Scoring
console.log('\n' + '='.repeat(60));
console.log('TEST 4: Budget Fit Scoring');
console.log('='.repeat(60));

const sofaBudget: CategoryBudget = {
  category: 'Seating',
  allocatedBudget: 5250, // 35% of $15,000
  priority: 'essential',
  minBudget: 4200, // 80% of allocated
  maxBudget: 6300  // 120% of allocated
};

const testPrices = [
  { price: 5250, description: 'Perfect fit (exactly at allocation)' },
  { price: 4500, description: 'Good fit (within allocated budget)' },
  { price: 3500, description: 'Under minimum (too cheap)' },
  { price: 6000, description: 'Slightly over (within max budget)' },
  { price: 7000, description: 'Over budget (beyond max)' },
  { price: 10000, description: 'Way over budget (2x allocation)' },
];

console.log(`\nCategory: ${sofaBudget.category}`);
console.log(`Allocated Budget: $${sofaBudget.allocatedBudget.toLocaleString()}`);
console.log(`Min Budget: $${sofaBudget.minBudget?.toLocaleString()}`);
console.log(`Max Budget: $${sofaBudget.maxBudget?.toLocaleString()}\n`);

testPrices.forEach(test => {
  const score = calculateBudgetFitScore(test.price, sofaBudget);
  const scoreDisplay = (score * 100).toFixed(0).padStart(3);
  console.log(`$${test.price.toLocaleString().padEnd(8)} → ${scoreDisplay}% fit | ${test.description}`);
});

// Test 5: Complete Budget Validation
console.log('\n' + '='.repeat(60));
console.log('TEST 5: Complete Room Design Budget Validation');
console.log('='.repeat(60));

// Simulate a Living Room design selection
console.log('\nLiving Room Design (Budget: $15,000)');
console.log('-'.repeat(60));

const livingRoomAllocation = calculateBudgetAllocation('Living Room', 'moderate');
const selectedProducts = [
  { name: 'Modern Sofa', category: 'Seating', price: 4500 },
  { name: 'Coffee Table', category: 'Tables', price: 1800 },
  { name: 'Area Rug', category: 'Rug', price: 2200 },
  { name: 'Accent Chair', category: 'Accent Chair', price: 1400 },
  { name: 'Floor Lamp', category: 'Lighting', price: 800 },
  { name: 'Side Table', category: 'Tables', price: 600 },
];

let totalCost = 0;
const categorySpending: Record<string, number> = {};

console.log('Selected Products:');
selectedProducts.forEach(product => {
  totalCost += product.price;
  categorySpending[product.category] = (categorySpending[product.category] || 0) + product.price;
  
  const budgetCat = livingRoomAllocation.categoryBudgets.find(cb => cb.category === product.category);
  const score = budgetCat ? calculateBudgetFitScore(product.price, budgetCat) : 0.5;
  const scorePercent = (score * 100).toFixed(0);
  
  console.log(`  ${product.name.padEnd(25)} $${product.price.toLocaleString().padStart(6)}  (${scorePercent}% fit)`);
});

console.log(`\nTotal Cost: $${totalCost.toLocaleString()}`);
console.log(`Budget Limit: $${(livingRoomAllocation.totalBudget + livingRoomAllocation.flexiblePool).toLocaleString()}`);
console.log(`Remaining: $${((livingRoomAllocation.totalBudget + livingRoomAllocation.flexiblePool) - totalCost).toLocaleString()}`);

const isCompliant = totalCost <= (livingRoomAllocation.totalBudget + livingRoomAllocation.flexiblePool);
console.log(`\n${isCompliant ? '✓' : '✗'} Budget Compliance: ${isCompliant ? 'PASS' : 'FAIL'}`);

console.log('\n' + '='.repeat(60));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(60));
