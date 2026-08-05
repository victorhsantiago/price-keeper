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
 * Robustly parses price and currency from raw text strings.
 * Handles European (1.499,99 € / 1.499,-), US/UK ($1,499.99), and space-delimited formats.
 */
function parsePrice(rawText) {
  if (!rawText) return null;

  // Clean non-breaking spaces and whitespace
  let cleaned = rawText
    .replace(/[\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  // Detect currency
  const currencyMatch = cleaned.match(/[$€£¥₹]|EUR|USD|GBP|CHF/i);
  let currency = '€';
  if (currencyMatch) {
    const symbolMap = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };
    const matched = currencyMatch[0].toUpperCase();
    currency = symbolMap[matched] || matched;
  }

  // Convert German/European dash notation: "1.499,-" -> "1.499,00"
  cleaned = cleaned.replace(/,\s*-\s*$/, ',00').replace(/\.\s*-\s*$/, '.00');

  // Find all numeric blocks
  const matches = cleaned.match(/[\d.,]+/g);
  if (!matches) return null;

  for (const rawMatch of matches) {
    let sanitized = rawMatch;

    // Both dot and comma present
    if (sanitized.includes('.') && sanitized.includes(',')) {
      if (sanitized.indexOf('.') < sanitized.indexOf(',')) {
        // European format: 1.499,99 -> 1499.99
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
      } else {
        // US/UK format: 1,499.99 -> 1499.99
        sanitized = sanitized.replace(/,/g, '');
      }
    } else if (sanitized.includes(',')) {
      // Single comma
      const parts = sanitized.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Decimal comma: 1499,99 -> 1499.99
        sanitized = sanitized.replace(',', '.');
      } else {
        // Thousand separator comma: 1,499 -> 1499
        sanitized = sanitized.replace(/,/g, '');
      }
    } else if (sanitized.includes('.')) {
      // Single dot
      const parts = sanitized.split('.');
      if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[1], 10) >= 100) {
        // Likely thousand separator dot: 1.499 -> 1499
        sanitized = sanitized.replace(/\./g, '');
      }
    }

    const num = parseFloat(sanitized);
    if (!isNaN(num) && num > 0 && num < 1000000) {
      return { price: num, currency };
    }
  }

  return null;
}

/**
 * Domain-specific selector presets for major e-commerce platforms
 */
function getDomainSelectors(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();

    if (hostname.includes('amazon')) {
      return [
        '#corePrice_feature_div .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        'span.a-price-whole'
      ];
    }

    if (hostname.includes('otto.de')) {
      return [
        '[data-qa="priceAmount"]',
        '[data-qa="price"]',
        '.p_price__amount',
        'span.p_price',
        '.p_price',
        'meta[itemprop="price"]',
        '.p_price__inner',
        'span[class*="price"]'
      ];
    }
  } catch {}

  return [];
}

/**
 * Generic fallback selectors
 */
const genericSelectors = [
  'meta[property="product:price:amount"]',
  'meta[property="og:price:amount"]',
  'meta[itemprop="price"]',
  '[data-qa="priceAmount"]',
  '[data-price]',
  '[data-product-price]',
  '.product-price',
  '.price-current',
  '.price',
  '#price'
];

/**
 * Sends Webhook Notification
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
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'de-DE',
    extraHTTPHeaders: {
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    }
  });

  const timestamp = new Date().toISOString();

  for (const product of activeProducts) {
    console.log(`\n[Scrape] Processing: "${product.name}" (${product.url})`);
    const page = await context.newPage();

    let extractedData = null;
    let errorMsg = null;

    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(2000);

      // Dismiss cookie consent banners if present
      try {
        const consentBtn = await page.$('#sp-cc-accept, #cookie-accept, button[data-qa="cookie-consent-accept"], .cookie-accept');
        if (consentBtn) {
          await consentBtn.click();
          await page.waitForTimeout(500);
        }
      } catch {}

      // 1. User-specified selector
      if (product.selector) {
        try {
          const el = await page.$(product.selector);
          if (el) {
            const text = await el.innerText();
            extractedData = parsePrice(text);
            if (extractedData) {
              console.log(`  -> Found via custom selector "${product.selector}":`, extractedData);
            }
          }
        } catch (e) {
          console.warn(`  -> Custom selector "${product.selector}" failed:`, e.message);
        }
      }

      // 2. Domain-specific preset selectors
      if (!extractedData) {
        const domainSelectors = getDomainSelectors(product.url);
        for (const selector of domainSelectors) {
          try {
            const el = await page.$(selector);
            if (el) {
              const text = await el.innerText();
              extractedData = parsePrice(text);
              if (extractedData) {
                console.log(`  -> Found via domain selector "${selector}":`, extractedData);
                break;
              }
            }
          } catch {}
        }
      }

      // 3. JSON-LD structured data
      if (!extractedData) {
        try {
          const jsonLdElements = await page.$$('script[type="application/ld+json"]');
          for (const el of jsonLdElements) {
            const rawJson = await el.innerText();
            try {
              const data = JSON.parse(rawJson);
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                const productObj = item['@type'] === 'Product' ? item : (item.mainEntity || item);
                if (productObj && productObj.offers) {
                  const offer = Array.isArray(productObj.offers)
                    ? productObj.offers[0]
                    : productObj.offers;
                  const priceRaw = offer.price || offer.highPrice || offer.lowPrice;
                  if (priceRaw !== undefined && priceRaw !== null) {
                    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(',', '.'));
                    const currency = offer.priceCurrency || '€';
                    if (!isNaN(price) && price > 0) {
                      extractedData = { price, currency };
                      console.log('  -> Found via JSON-LD metadata:', extractedData);
                      break;
                    }
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

      // 4. Meta tags and Generic selectors
      if (!extractedData) {
        for (const selector of genericSelectors) {
          try {
            const el = await page.$(selector);
            if (el) {
              const text = (await el.getAttribute('content')) || (await el.innerText());
              extractedData = parsePrice(text);
              if (extractedData) {
                console.log(`  -> Found via generic selector "${selector}":`, extractedData);
                break;
              }
            }
          } catch {}
        }
      }

      // 5. Page Body Text Regex Fallback
      if (!extractedData) {
        try {
          const bodyText = await page.innerText('body');
          const matches = bodyText.match(/(?:[$€£¥]\s*[\d.,]+|[\d.,]+\s*[$€£¥])/g);
          if (matches && matches.length > 0) {
            for (const m of matches) {
              const parsed = parsePrice(m);
              if (parsed && parsed.price > 10) {
                extractedData = parsed;
                console.log(`  -> Found via page body text fallback ("${m.trim()}"):`, extractedData);
                break;
              }
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
        currency: lastRecord ? lastRecord.currency : '€',
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
