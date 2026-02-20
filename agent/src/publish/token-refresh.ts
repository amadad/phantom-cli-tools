/**
 * Token Refresh — programmatic refresh for Instagram, Threads, LinkedIn.
 *
 * Instagram: GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
 * Threads:   GET graph.threads.net/refresh_access_token?grant_type=th_refresh_token
 * LinkedIn:  requires refresh_token (Marketing Developer Platform only)
 *
 * Facebook page tokens and Twitter OAuth 1.0a tokens never expire.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { discoverBrands } from '../core/paths'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ENV_PATH = join(__dirname, '..', '..', '..', '.env')
const EXPIRY_PATH = join(__dirname, '..', '..', '..', '.token-expiry.json')

// Days before expiry to trigger refresh
const REFRESH_THRESHOLD_DAYS = 10
const FETCH_TIMEOUT_MS = 10_000

/** Expiry tracking — stores ISO date when each token expires */
interface ExpiryMap { [key: string]: string }

function loadExpiry(): ExpiryMap {
  if (!existsSync(EXPIRY_PATH)) return {}
  try {
    return JSON.parse(readFileSync(EXPIRY_PATH, 'utf-8'))
  } catch { return {} }
}

function saveExpiry(map: ExpiryMap): void {
  writeFileSync(EXPIRY_PATH, JSON.stringify(map, null, 2) + '\n')
}

function recordExpiry(envKey: string, daysFromNow: number): void {
  const map = loadExpiry()
  const expires = new Date(Date.now() + daysFromNow * 86400_000)
  map[envKey] = expires.toISOString()
  saveExpiry(map)
}

function getDaysRemaining(envKey: string): number | undefined {
  const map = loadExpiry()
  const iso = map[envKey]
  if (!iso) return undefined
  const diff = new Date(iso).getTime() - Date.now()
  return Math.round(diff / 86400_000)
}

export interface TokenStatus {
  platform: string
  brand: string
  status: 'ok' | 'refreshed' | 'expired' | 'no_refresh' | 'never_expires' | 'error'
  message: string
  daysRemaining?: number
}

/** Platforms that never expire */
const NEVER_EXPIRES = new Set(['twitter', 'facebook'])

/** Read current .env content */
function readEnv(): string {
  return readFileSync(ENV_PATH, 'utf-8')
}

/** Replace a token value in .env and write back */
function updateEnvToken(envKey: string, newValue: string): void {
  const env = readEnv()
  const needle = `${envKey}="`
  const start = env.indexOf(needle)
  if (start === -1) return
  const valueStart = start + needle.length
  const valueEnd = env.indexOf('"', valueStart)
  if (valueEnd === -1) return
  const updated = env.slice(0, valueStart) + newValue + env.slice(valueEnd)
  writeFileSync(ENV_PATH, updated)
}

/** Get env var, checking both process.env and .env file directly */
function getEnv(key: string): string | undefined {
  return process.env[key]
}

/** Refresh an Instagram long-lived token */
async function refreshInstagram(brand: string): Promise<TokenStatus> {
  const brandUpper = brand.toUpperCase()
  const envKey = `INSTAGRAM_${brandUpper}_ACCESS_TOKEN`
  const token = getEnv(envKey)

  if (!token) {
    return { platform: 'instagram', brand, status: 'error', message: 'No token configured' }
  }

  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    const text = await res.text()
    // If token is already expired, can't refresh
    if (res.status === 400 && text.includes('expired')) {
      return {
        platform: 'instagram', brand, status: 'expired',
        message: 'Token expired. Must re-auth manually via Meta Developer Console > Use cases > Instagram > Generate access tokens'
      }
    }
    return { platform: 'instagram', brand, status: 'error', message: `Refresh failed: ${res.status} ${text}` }
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  updateEnvToken(envKey, data.access_token)
  process.env[envKey] = data.access_token

  const days = Math.round(data.expires_in / 86400)
  recordExpiry(envKey, days)
  return {
    platform: 'instagram', brand, status: 'refreshed',
    message: `Refreshed. New token expires in ${days} days`,
    daysRemaining: days,
  }
}

/** Refresh a Threads long-lived token */
async function refreshThreads(brand: string): Promise<TokenStatus> {
  const brandUpper = brand.toUpperCase()
  const envKey = `THREADS_${brandUpper}_ACCESS_TOKEN`
  const token = getEnv(envKey)

  if (!token) {
    return { platform: 'threads', brand, status: 'error', message: 'No token configured' }
  }

  const url = new URL('https://graph.threads.net/refresh_access_token')
  url.searchParams.set('grant_type', 'th_refresh_token')
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 400 && text.includes('expired')) {
      return {
        platform: 'threads', brand, status: 'expired',
        message: 'Token expired. Must re-auth manually via Meta Developer Console > Use cases > Threads > Generate access tokens'
      }
    }
    return { platform: 'threads', brand, status: 'error', message: `Refresh failed: ${res.status} ${text}` }
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  updateEnvToken(envKey, data.access_token)
  process.env[envKey] = data.access_token

  const days = Math.round(data.expires_in / 86400)
  recordExpiry(envKey, days)
  return {
    platform: 'threads', brand, status: 'refreshed',
    message: `Refreshed. New token expires in ${days} days`,
    daysRemaining: days,
  }
}

/** Check if a token is still valid by making a lightweight API call */
async function probeInstagram(brand: string): Promise<{ valid: boolean; expiresIn?: number }> {
  const token = getEnv(`INSTAGRAM_${brand.toUpperCase()}_ACCESS_TOKEN`)
  if (!token) return { valid: false }

  const url = `https://graph.instagram.com/me?fields=id&access_token=${token}`
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) return { valid: false }

  // Token works — try to get expiry info from debug endpoint
  return { valid: true }
}

async function probeThreads(brand: string): Promise<{ valid: boolean }> {
  const token = getEnv(`THREADS_${brand.toUpperCase()}_ACCESS_TOKEN`)
  if (!token) return { valid: false }

  const url = `https://graph.threads.net/me?fields=id&access_token=${token}`
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  return { valid: res.ok }
}

async function probeLinkedIn(brand: string): Promise<{ valid: boolean }> {
  const token = getEnv(`LINKEDIN_${brand.toUpperCase()}_ACCESS_TOKEN`)
  if (!token) return { valid: false }

  const res = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  return { valid: res.ok }
}

/**
 * Check token health for a single brand across all platforms.
 * Returns status for each platform.
 */
export async function checkTokens(brand: string): Promise<TokenStatus[]> {
  const brandUpper = brand.toUpperCase()
  const results: TokenStatus[] = []

  // Twitter — never expires
  if (getEnv(`TWITTER_${brandUpper}_API_KEY`)) {
    results.push({ platform: 'twitter', brand, status: 'never_expires', message: 'OAuth 1.0a tokens never expire' })
  }

  // Facebook — page tokens never expire
  if (getEnv(`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`)) {
    results.push({ platform: 'facebook', brand, status: 'never_expires', message: 'Page tokens never expire' })
  }

  // Instagram
  if (getEnv(`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`)) {
    const probe = await probeInstagram(brand)
    const days = getDaysRemaining(`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`)
    if (probe.valid) {
      const msg = days !== undefined ? `Token valid (${days}d remaining)` : 'Token valid'
      results.push({ platform: 'instagram', brand, status: 'ok', message: msg, daysRemaining: days })
    } else {
      results.push({ platform: 'instagram', brand, status: 'expired', message: 'Token expired or invalid' })
    }
  }

  // Threads
  if (getEnv(`THREADS_${brandUpper}_ACCESS_TOKEN`)) {
    const probe = await probeThreads(brand)
    const days = getDaysRemaining(`THREADS_${brandUpper}_ACCESS_TOKEN`)
    if (probe.valid) {
      const msg = days !== undefined ? `Token valid (${days}d remaining)` : 'Token valid'
      results.push({ platform: 'threads', brand, status: 'ok', message: msg, daysRemaining: days })
    } else {
      results.push({ platform: 'threads', brand, status: 'expired', message: 'Token expired or invalid' })
    }
  }

  // LinkedIn
  if (getEnv(`LINKEDIN_${brandUpper}_ACCESS_TOKEN`)) {
    const probe = await probeLinkedIn(brand)
    const days = getDaysRemaining(`LINKEDIN_${brandUpper}_ACCESS_TOKEN`)
    if (probe.valid) {
      const msg = days !== undefined ? `Token valid (${days}d remaining)` : 'Token valid'
      results.push({ platform: 'linkedin', brand, status: 'ok', message: msg, daysRemaining: days })
    } else {
      results.push({
        platform: 'linkedin', brand, status: 'expired',
        message: 'Token expired. Run: cd agent && npx tsx scripts/linkedin-auth.ts'
      })
    }
  }

  return results
}

/**
 * Refresh all refreshable tokens for a brand.
 * Instagram and Threads can be refreshed programmatically.
 * LinkedIn requires manual re-auth (no refresh_token).
 */
export async function refreshTokens(brand: string, force = false): Promise<TokenStatus[]> {
  const brandUpper = brand.toUpperCase()
  const results: TokenStatus[] = []

  // Instagram
  if (getEnv(`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`)) {
    if (force) {
      results.push(await refreshInstagram(brand))
    } else {
      const probe = await probeInstagram(brand)
      if (probe.valid) {
        // Refresh proactively even if valid — extends the 60-day window
        results.push(await refreshInstagram(brand))
      } else {
        results.push({
          platform: 'instagram', brand, status: 'expired',
          message: 'Token expired. Must re-auth manually via Meta Developer Console'
        })
      }
    }
  }

  // Threads
  if (getEnv(`THREADS_${brandUpper}_ACCESS_TOKEN`)) {
    if (force) {
      results.push(await refreshThreads(brand))
    } else {
      const probe = await probeThreads(brand)
      if (probe.valid) {
        results.push(await refreshThreads(brand))
      } else {
        results.push({
          platform: 'threads', brand, status: 'expired',
          message: 'Token expired. Must re-auth manually via Meta Developer Console'
        })
      }
    }
  }

  // LinkedIn — no programmatic refresh
  if (getEnv(`LINKEDIN_${brandUpper}_ACCESS_TOKEN`)) {
    const probe = await probeLinkedIn(brand)
    if (probe.valid) {
      results.push({ platform: 'linkedin', brand, status: 'ok', message: 'Token valid (no auto-refresh available)' })
    } else {
      results.push({
        platform: 'linkedin', brand, status: 'no_refresh',
        message: 'Token expired. Run: cd agent && npx tsx scripts/linkedin-auth.ts'
      })
    }
  }

  return results
}

/**
 * Pre-flight check for the post command.
 * Checks target platforms, auto-refreshes if possible, warns if not.
 * Returns list of platforms that are ready to post.
 */
export async function preflightTokenCheck(
  brand: string,
  platforms: string[]
): Promise<{ ready: string[]; failed: TokenStatus[] }> {
  const ready: string[] = []
  const failed: TokenStatus[] = []

  for (const platform of platforms) {
    if (NEVER_EXPIRES.has(platform)) {
      ready.push(platform)
      continue
    }

    // Probe the token
    let valid = false
    if (platform === 'instagram') {
      valid = (await probeInstagram(brand)).valid
    } else if (platform === 'threads') {
      valid = (await probeThreads(brand)).valid
    } else if (platform === 'linkedin') {
      valid = (await probeLinkedIn(brand)).valid
    } else {
      ready.push(platform)
      continue
    }

    if (valid) {
      ready.push(platform)
      continue
    }

    // Token invalid — try to refresh
    if (platform === 'instagram') {
      const result = await refreshInstagram(brand)
      if (result.status === 'refreshed') {
        console.log(`[token] Refreshed instagram/${brand} token`)
        ready.push(platform)
      } else {
        failed.push(result)
      }
    } else if (platform === 'threads') {
      const result = await refreshThreads(brand)
      if (result.status === 'refreshed') {
        console.log(`[token] Refreshed threads/${brand} token`)
        ready.push(platform)
      } else {
        failed.push(result)
      }
    } else if (platform === 'linkedin') {
      failed.push({
        platform: 'linkedin', brand, status: 'no_refresh',
        message: 'Token expired. Run: cd agent && npx tsx scripts/linkedin-auth.ts'
      })
    }
  }

  return { ready, failed }
}
