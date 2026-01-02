#!/usr/bin/env npx tsx
/**
 * Upload brand reference images to R2
 * Usage: npx tsx scripts/upload-references.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BRANDS_DIR = join(process.cwd(), 'brands');

// R2 credentials from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = 'phantom-loom';
const R2_PUBLIC_URL = 'https://pub-4d9471dbec644c5b90e77e776b4c6c8e.r2.dev';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials. Set:');
  console.error('  R2_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID)');
  console.error('  R2_ACCESS_KEY_ID');
  console.error('  R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

async function uploadFile(localPath: string, r2Key: string): Promise<string> {
  const data = readFileSync(localPath);
  const ext = extname(localPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: data,
    ContentType: contentType
  }));

  return `${R2_PUBLIC_URL}/${r2Key}`;
}

async function main() {
  console.log('═'.repeat(50));
  console.log('  UPLOAD REFERENCE IMAGES TO R2');
  console.log('═'.repeat(50));

  const brands = readdirSync(BRANDS_DIR).filter(f => {
    const path = join(BRANDS_DIR, f);
    return existsSync(join(path, 'styles'));
  });

  for (const brand of brands) {
    const stylesDir = join(BRANDS_DIR, brand, 'styles');
    const files = readdirSync(stylesDir).filter(f =>
      f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')
    );

    console.log(`\n${brand}: ${files.length} images`);

    for (const file of files) {
      const localPath = join(stylesDir, file);
      const r2Key = `references/${brand}/${file}`;

      try {
        const url = await uploadFile(localPath, r2Key);
        console.log(`  ✓ ${file} → ${url}`);
      } catch (err: any) {
        console.error(`  ✗ ${file}: ${err.message}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('  DONE');
  console.log('═'.repeat(50));
  console.log('\nUpdate brand YAML reference_styles.images to use R2 URLs');
}

main().catch(console.error);
