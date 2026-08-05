import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const productsPath = path.join(rootDir, 'data', 'products.json');
const historyPath = path.join(rootDir, 'data', 'history.json');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Extracts numeric price and currency symbol from text content
 */
function parsePrice(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/\s+/g, ' ').trim();

  // Try currency match
  const currencyMatch = cleaned.match(/[$€£¥₹]/);
  const currency = currencyMatch ? currencyMatch[0] : '$';

  // Extract number (supporting formats like 1,299.99 or 1299,99 or 99.99)
  // Replaces dot thousand-separators or comma decimal separators safely
  const numberMatches = cleaned.match(/[\d.,]+/g);
  if (!numberMatches) return null;

  for (const match of numberMatches) {
    let sanitized = match;
    if (sanitized.includes(',') && sanitized.includes('.')) {
      if (sanitized.indexOf(',') < sanitized.indexOf('.')) {
        sanitized = sanitized.replace(/,/g, ''); // 1,299.99 -> 1299.99
      } else {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.'); // 1.299,99 -> 1299.99
      }
    } else if (sanitized.includes(',')) {
      // If single comma, check if it looks like decimal or thousand separator
      const parts = sanitized.split(',');
      if (parts[1] && parts[1].length === 2) {
        sanitized = sanitized.replace(',', '.');
      } else {
        sanitized = sanitized.replace(/,/g, '');
      }
    }

    const num = parseFloat(sanitized);
    if (!isNaN(num) && num > 0) {
      return { price: num, currency };
    }
  }

  return null;
}

/**
 * Sends optional Webhook notification
 */
async function sendNotification(product, newPrice, currency, oldPrice) {
  const webhookUrl = process.env.WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const dropPercent = oldPrice ? (((oldPrice - newPrice) / oldPrice) * 100).toFixed(1) : 0;
  const title = `🚨 Price Drop Alert: ${product.name}`;
  const description = `Price dropped from **${currency}${oldPrice ?? 'N/A'}** to **${currency}${newPrice}** (${dropPercent}% drop)!\nTarget Price: ${currency}${product.targetPrice}\n[View Product](${product.url})`;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color: 0x10b981,
            timestamp: new Date().toISOString()
          }
        ]
      })
    });
    console.log(`[Notification] Alert sent for ${product.name}`);
  } catch (err) {
    console.error(`[Notification Error] Failed to send webhook alert:`, err.message);
  }
}

async function runScraper() {
  console.log(`[Scraper] Starting price check... ${isDryRun ? '(DRY RUN)' : ''}`);

  if (!fs.existsSync(productsPath)) {
    console.error(`[Scraper Error] Products file not found at ${productsPath}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  let history = {};
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch {
      history = {};
    }
  }

  const activeProducts = products.filter(p => p.active !== false);
  console.log(`[Scraper] Found ${activeProducts.length} active products to scrape.`);

  if (activeProducts.length === 0) {
    console.log('[Scraper] No active products to scrape.');
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const timestamp = new Date().toISOString();

  for (const product of activeProducts) {
    console.log(`\n[Scrape] Processing: "${product.name}" (${product.url})`);
    const page = await context.newPage();

    let extractedData = null;
    let errorMsg = null;

    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 1. Try specified custom CSS selector if provided
      if (product.selector) {
        try {
          const el = await page.$(product.selector);
          if (el) {
            const text = await el.innerText();
            extractedData = parsePrice(text);
            if (extractedData) {
              console.log(`  -> Found via selector "${product.selector}":`, extractedData);
            }
          }
        } catch (e) {
          console.warn(`  -> Selector "${product.selector}" failed:`, e.message);
        }
      }

      // 2. Fallback to JSON-LD structured data
      if (!extractedData) {
        try {
          const jsonLdElements = await page.$$('script[type="application/ld+json"]');
          for (const el of jsonLdElements) {
            const rawJson = await el.innerText();
            try {
              const data = JSON.parse(rawJson);
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                const productObj = item['@type'] === 'Product' ? item : item.mainEntity;
                if (productObj && productObj.offers) {
                  const offer = Array.isArray(productObj.offers)
                    ? productObj.offers[0]
                    : productObj.offers;
                  const price = parseFloat(offer.price || offer.highPrice || offer.lowPrice);
                  const currency = offer.priceCurrency || '$';
                  if (!isNaN(price) && price > 0) {
                    extractedData = { price, currency };
                    console.log('  -> Found via JSON-LD metadata:', extractedData);
                    break;
                  }
                }
              }
            } catch {}
            if (extractedData) break;
          }
        } catch (e) {
          console.warn('  -> JSON-LD extraction error:', e.message);
        }
      }

      // 3. Fallback to OpenGraph meta tags
      if (!extractedData) {
        try {
          const ogPrice = await page.$eval(
            'meta[property="og:price:amount"], meta[name="twitter:data1"]',
            el => el.getAttribute('content')
          );
          if (ogPrice) {
            extractedData = parsePrice(ogPrice);
            if (extractedData) {
              console.log('  -> Found via OpenGraph meta tags:', extractedData);
            }
          }
        } catch {}
      }
    } catch (err) {
      errorMsg = err.message;
      console.error(`  -> Failed to scrape "${product.name}":`, errorMsg);
    } finally {
      await page.close();
    }

    if (!history[product.id]) {
      history[product.id] = [];
    }

    const previousRecords = history[product.id];
    const lastRecord = previousRecords.length > 0 ? previousRecords[previousRecords.length - 1] : null;

    if (extractedData) {
      const record = {
        timestamp,
        price: extractedData.price,
        currency: extractedData.currency,
        status: 'success'
      };
      history[product.id].push(record);

      if (lastRecord && lastRecord.status === 'success' && extractedData.price < lastRecord.price) {
        console.log(`  -> 🎉 Price Drop Detected! Was: ${lastRecord.price}, Now: ${extractedData.price}`);
        if (!isDryRun) {
          await sendNotification(product, extractedData.price, extractedData.currency, lastRecord.price);
        }
      }
    } else {
      history[product.id].push({
        timestamp,
        price: lastRecord ? lastRecord.price : null,
        currency: lastRecord ? lastRecord.currency : '$',
        status: 'error',
        error: errorMsg || 'Unable to extract price with configured selectors'
      });
    }
  }

  await browser.close();

  if (!isDryRun) {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    console.log(`\n[Scraper] Successfully updated ${historyPath}`);
  } else {
    console.log('\n[Scraper] Dry run complete. No files modified.');
  }
}

runScraper().catch(err => {
  console.error('[Fatal Scraper Error]:', err);
  process.exit(1);
});
