import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase, isSupabaseConfigured } from './supabase-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const productsPath = path.join(rootDir, 'data', 'products.json');
const historyPath = path.join(rootDir, 'data', 'history.json');

async function seedDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase credentials missing in environment.');
    process.exit(1);
  }

  console.log('🌱 Starting database seed from local JSON files...');

  // 1. Seed Products
  if (fs.existsSync(productsPath)) {
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`📦 Found ${productsData.length} product(s) in products.json.`);

    for (const p of productsData) {
      const { error } = await supabase.from('products').upsert({
        id: p.id,
        name: p.name,
        url: p.url,
        selector: p.selector || '',
        target_price: p.targetPrice || 0,
        active: p.active !== false,
        added_at: p.addedAt || new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Failed to upsert product ${p.name} (${p.id}):`, error.message);
      } else {
        console.log(`  ✓ Product seeded: ${p.name}`);
      }
    }
  }

  // 2. Seed Price History
  if (fs.existsSync(historyPath)) {
    const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    let recordCount = 0;

    for (const [productId, records] of Object.entries(historyData)) {
      if (!Array.isArray(records)) continue;

      for (const rec of records) {
        const { error } = await supabase.from('price_history').insert({
          product_id: productId,
          price: rec.price,
          currency: rec.currency || '€',
          status: rec.status || 'success',
          error: rec.error || null,
          timestamp: rec.timestamp || new Date().toISOString()
        });

        if (error) {
          console.error(`❌ Failed to insert history record for product ${productId}:`, error.message);
        } else {
          recordCount++;
        }
      }
    }

    console.log(`📊 Seeded ${recordCount} price history record(s).`);
  }

  console.log('🎉 Database seeding complete!');
}

seedDatabase().catch(err => {
  console.error('❌ Seed script error:', err);
  process.exit(1);
});
