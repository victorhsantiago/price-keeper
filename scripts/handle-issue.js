import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const productsPath = path.join(rootDir, 'data', 'products.json');
const historyPath = path.join(rootDir, 'data', 'history.json');

const issueTitle = process.env.ISSUE_TITLE || '';
const issueBody = process.env.ISSUE_BODY || '';

function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');
  let currentKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      currentKey = trimmed.replace('### ', '').trim().toLowerCase();
    } else if (currentKey && trimmed) {
      data[currentKey] = (data[currentKey] ? data[currentKey] + '\n' + trimmed : trimmed).trim();
    }
  }

  return data;
}

function handleIssue() {
  console.log('[Issue Handler] Processing issue action...');
  console.log('Title:', issueTitle);

  if (!fs.existsSync(productsPath)) {
    fs.writeFileSync(productsPath, '[]', 'utf8');
  }

  let products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

  const parsedFields = parseIssueBody(issueBody);

  const isRemove = issueTitle.toLowerCase().includes('remove') || parsedFields['action'] === 'remove';

  if (isRemove) {
    const targetId = parsedFields['product id'] || parsedFields['id'] || parsedFields['url'] || issueTitle.replace(/\[.*\]/, '').trim();
    console.log(`[Issue Handler] Removing product matching: "${targetId}"`);
    const initialCount = products.length;
    products = products.filter(p => p.id !== targetId && p.url !== targetId && p.name !== targetId);
    console.log(`[Issue Handler] Removed ${initialCount - products.length} product(s).`);
  } else {
    // Default to ADD_PRODUCT
    const name = parsedFields['product name'] || parsedFields['name'] || issueTitle.replace(/\[.*\]/, '').trim() || 'New Product';
    const url = parsedFields['product url'] || parsedFields['url'] || '';
    const selector = parsedFields['custom css selector (optional)'] || parsedFields['selector'] || '';
    const targetPriceRaw = parsedFields['target price'] || parsedFields['targetprice'] || '0';
    const targetPrice = parseFloat(targetPriceRaw.replace(/[^0-9.]/g, '')) || 0;

    if (!url) {
      console.error('[Issue Handler Error] Product URL is required in issue body.');
      process.exit(1);
    }

    const id = `prod_${Date.now()}`;
    const newProduct = {
      id,
      name,
      url,
      selector: selector !== '_No response_' ? selector : '',
      targetPrice,
      active: true,
      addedAt: new Date().toISOString()
    };

    console.log('[Issue Handler] Adding product:', newProduct);
    // Remove duplicate URL if already watching
    products = products.filter(p => p.url !== url);
    products.push(newProduct);
  }

  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
  console.log('[Issue Handler] Updated products.json successfully.');
}

try {
  handleIssue();
} catch (err) {
  console.error('[Issue Handler Error]:', err);
  process.exit(1);
}
