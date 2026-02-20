/**
 * Cloudflare R2 upload utility
 * Used to host images for Instagram/Threads which require public URLs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import crypto from 'crypto'
import { getMimeType } from './http'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL

  const missing = [
    ['R2_ACCOUNT_ID', accountId],
    ['R2_ACCESS_KEY_ID', accessKeyId],
    ['R2_SECRET_ACCESS_KEY', secretAccessKey],
    ['R2_BUCKET_NAME', bucketName],
    ['R2_PUBLIC_URL', publicUrl],
  ].filter(([, v]) => !v).map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(`R2 not configured. Missing: ${missing.join(', ')}`)
  }

  return { accountId: accountId!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucketName: bucketName!, publicUrl: publicUrl! }
}

function getClient(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  })
}

/**
 * Upload a local file to R2 and return the public URL
 */
export async function uploadToR2(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const config = getConfig()
  const client = getClient(config)

  const fileData = readFileSync(filePath)
  const hash = crypto.createHash('md5').update(fileData).digest('hex').slice(0, 8)
  const ext = extname(filePath)
  const key = `phantom-loom/${Date.now()}-${hash}${ext}`

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: fileData,
    ContentType: getMimeType(filePath)
  })

  try {
    await client.send(command)
  } catch (err) {
    throw new Error(`R2 upload failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
  }

  const publicUrl = `${config.publicUrl.replace(/\/$/, '')}/${key}`
  console.log(`[r2] Uploaded: ${publicUrl}`)

  return publicUrl
}

/**
 * Upload a buffer to R2 and return the public URL
 */
export async function uploadBufferToR2(
  data: Buffer,
  mimeType: string,
  filename?: string
): Promise<string> {
  const config = getConfig()
  const client = getClient(config)

  const hash = crypto.createHash('md5').update(data).digest('hex').slice(0, 8)
  const ext = mimeType.includes('png') ? '.png' : mimeType.includes('gif') ? '.gif' : '.jpg'
  const key = `phantom-loom/${Date.now()}-${hash}${ext}`

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: data,
    ContentType: mimeType
  })

  try {
    await client.send(command)
  } catch (err) {
    throw new Error(`R2 upload failed for buffer: ${err instanceof Error ? err.message : String(err)}`)
  }

  const publicUrl = `${config.publicUrl.replace(/\/$/, '')}/${key}`
  console.log(`[r2] Uploaded: ${publicUrl}`)

  return publicUrl
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  try {
    getConfig()
    return true
  } catch {
    return false
  }
}
