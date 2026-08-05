import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

if (fs.existsSync(path.join(rootDir, '.env.local'))) {
  dotenv.config({ path: path.join(rootDir, '.env.local') });
} else {
  dotenv.config();
}

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  console.error('❌ Error: DATABASE_URL is not set in environment or .env.local');
  process.exit(1);
}

// Regions for Supabase AWS Poolers
const POOLER_REGIONS = ['eu-central-1', 'eu-west-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'sa-east-1'];

function parseConnectionString(connStr) {
  const url = new URL(connStr);
  const user = url.username;
  const password = url.password;
  const host = url.hostname;
  const port = url.port || 5432;
  const database = url.pathname.substring(1) || 'postgres';

  // Extract project ref (e.g. db.oulabjmaxlhmutonqehw.supabase.co -> oulabjmaxlhmutonqehw)
  const refMatch = host.match(/db\.([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch ? refMatch[1] : null;

  return { user, password, host, port, database, projectRef };
}

async function tryConnect(config) {
  const client = new Client({
    connectionString: config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    await client.end().catch(() => null);
    throw err;
  }
}

async function runMigrations() {
  console.log('🚀 Running database migrations...');
  const { user, password, host, database, projectRef } = parseConnectionString(rawConnectionString);

  let client = null;

  // 1. Try raw connection string first
  try {
    client = await tryConnect(rawConnectionString);
    console.log(`✅ Connected directly to ${host}.`);
  } catch (err) {
    console.log(`⚠️ Direct connection to ${host} failed (${err.code || err.message}). Testing connection poolers...`);
  }

  // 2. If direct fails and we have projectRef, try AWS pooler endpoints
  if (!client && projectRef) {
    const poolerUser = user.includes('.') ? user : `${user}.${projectRef}`;
    
    for (const region of POOLER_REGIONS) {
      const poolerHost = `aws-0-${region}.pooler.supabase.com`;
      for (const port of [6543, 5432]) {
        const poolerConnStr = `postgres://${encodeURIComponent(poolerUser)}:${encodeURIComponent(password)}@${poolerHost}:${port}/${database}?sslmode=require`;
        try {
          console.log(`  Trying pooler ${poolerHost}:${port}...`);
          client = await tryConnect(poolerConnStr);
          console.log(`✅ Successfully connected via pooler (${region}:${port})!`);
          break;
        } catch (e) {
          // Continue trying next
        }
      }
      if (client) break;
    }
  }

  if (!client) {
    console.error('❌ Migration failed: Could not connect to PostgreSQL via direct host or poolers.');
    process.exit(1);
  }

  try {
    const sqlPath = path.join(rootDir, 'supabase', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('🎉 Migrations executed successfully!');
  } catch (err) {
    console.error('❌ SQL Execution failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
