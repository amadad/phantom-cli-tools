/**
 * Shared HTTP utilities
 */

import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'

const ALLOWED_PROTOCOLS = ['https:', 'http:']
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

/**
 * Check if an IP address is in a private range
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 check
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    // 10.0.0.0/8
    if (a === 10) return true
    // 172.16.0.0/12 (172.16.* - 172.31.*)
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true
    // 0.0.0.0
    if (a === 0) return true
  }

  // IPv6 loopback and private ranges
  const lower = hostname.toLowerCase()
  if (
    lower === '::1' ||
    lower === '[::1]' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  ) {
    return true
  }

  return false
}

/**
 * Validate URL before fetching
 * Prevents SSRF by checking protocol and blocking internal IPs
 */
export function validateUrl(urlString: string): URL {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error(`Invalid URL: ${urlString}`)
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Invalid protocol: ${url.protocol}. Must be http or https`)
  }

  // Block localhost and private IPs
  const hostname = url.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateIP(hostname)
  ) {
    throw new Error(`Blocked internal URL: ${hostname}`)
  }

  return url
}

/**
 * Get mime type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Download image from URL or read from local path
 */
export async function downloadImage(urlOrPath: string): Promise<{ data: Buffer; mimeType: string }> {
  // Handle local file paths
  if (urlOrPath.startsWith('/') || urlOrPath.startsWith('./') || urlOrPath.startsWith('../')) {
    if (!existsSync(urlOrPath)) {
      throw new Error(`File not found: ${urlOrPath}`)
    }
    const data = readFileSync(urlOrPath)
    const mimeType = getMimeType(urlOrPath)

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new Error(`Invalid image type: ${mimeType}. Expected: ${ALLOWED_IMAGE_TYPES.join(', ')}`)
    }

    if (data.length > 20 * 1024 * 1024) {
      throw new Error(`Image too large: ${(data.length / 1024 / 1024).toFixed(1)}MB (max 20MB)`)
    }

    return { data, mimeType }
  }

  // Handle URLs
  validateUrl(urlOrPath)

  const response = await fetch(urlOrPath)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const mimeType = contentType.split(';')[0].trim().toLowerCase()

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Expected: ${ALLOWED_IMAGE_TYPES.join(', ')}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const data = Buffer.from(arrayBuffer)

  if (data.length > 20 * 1024 * 1024) {
    throw new Error(`Image too large: ${(data.length / 1024 / 1024).toFixed(1)}MB (max 20MB)`)
  }

  return { data, mimeType }
}

/**
 * Fetch JSON with timeout and error handling
 */
export async function fetchJson<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}
