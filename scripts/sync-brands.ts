#!/usr/bin/env npx tsx
/**
 * Sync brand YAML files to Cloudflare D1 via Workers API
 *
 * Usage:
 *   npx tsx scripts/sync-brands.ts              # Sync to local dev
 *   npx tsx scripts/sync-brands.ts --prod       # Sync to production
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

const BRANDS_DIR = join(process.cwd(), 'brands');
const DEV_URL = 'http://localhost:8787';
const PROD_URL = process.env.WORKERS_URL || 'https://phantom-loom.workers.dev';

interface BrandProfile {
  name: string;
  slug?: string;
  voice: {
    tone: string;
    style: string;
    rules: string[];
  };
  visual: {
    palette: Record<string, string>;
    style: string;
    mood: string;
    avoid: string[];
    image_direction?: any;
    reference_styles?: any[];
    image_generation?: any;
  };
  platforms?: Record<string, any>;
}

async function loadBrands(): Promise<BrandProfile[]> {
  const brands: BrandProfile[] = [];

  const files = readdirSync(BRANDS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const slug = file.replace(/\.ya?ml$/, '');
    const content = readFileSync(join(BRANDS_DIR, file), 'utf-8');

    try {
      const brand = yaml.load(content) as BrandProfile;
      brand.slug = slug;
      brands.push(brand);
      console.log(`  Loaded: ${slug} (${brand.name})`);
    } catch (err: any) {
      console.error(`  Error loading ${file}: ${err.message}`);
    }
  }

  return brands;
}

async function syncBrands(brands: BrandProfile[], baseUrl: string): Promise<void> {
  console.log(`\nSyncing ${brands.length} brands to ${baseUrl}...`);

  const response = await fetch(`${baseUrl}/api/admin/sync-brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brands })
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json() as { results: Array<{ slug: string; status: string }> };

  console.log('\nResults:');
  for (const r of result.results) {
    const icon = r.status === 'synced' ? '✓' : '✗';
    console.log(`  ${icon} ${r.slug}: ${r.status}`);
  }
}

async function main() {
  const isProd = process.argv.includes('--prod');
  const baseUrl = isProd ? PROD_URL : DEV_URL;

  console.log('═'.repeat(50));
  console.log('  BRAND SYNC');
  console.log('═'.repeat(50));
  console.log(`\nEnvironment: ${isProd ? 'PRODUCTION' : 'LOCAL DEV'}`);
  console.log(`Target: ${baseUrl}\n`);

  console.log('Loading brands from YAML...');
  const brands = await loadBrands();

  if (brands.length === 0) {
    console.log('\nNo brands found in brands/ directory');
    return;
  }

  await syncBrands(brands, baseUrl);

  console.log('\n' + '═'.repeat(50));
  console.log('  SYNC COMPLETE');
  console.log('═'.repeat(50));
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
