/**
 * Token Refresh — programmatic refresh for Instagram, Threads, LinkedIn.
 *
 * Instagram: GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
 * Threads:   GET graph.threads.net/refresh_access_token?grant_type=th_refresh_token
 * LinkedIn:  POST linkedin.com/oauth/v2/accessToken (grant_type=refresh_token, 365-day refresh token)
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

const FETCH_TIMEOUT_MS = 10_000

interface ExpiryMap { [key: string]: string }

function loadExpiry(): ExpiryMap {
  if (!existsSync(EXPIRY_PATH)) return {}
  try { return JSON.parse(readFileSync(EXPIRY_PATH, 'utf-8')) } catch { return {} }
}

function saveExpiry(map: ExpiryMap): void {
  writeFileSync(EXPIRY_PATH, JSON.stringify(map, null, 2) + '\n')
}

function recordExpiry(envKey: string, daysFromNow: number): void {
  const map = loadExpiry()
  map[envKey] = new Date(Date.now() + daysFromNow * 86400_000).toISOString()
  saveExpiry(map)
}

function getDaysRemaining(envKey: string): number | undefined {
  const map = loadExpiry()
  const iso = map[envKey]
  if (!iso) return undefined
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400_000)
}

export interface TokenStatus {
  platform: string
  brand: string
  status: 'ok' | 'refreshed' | 'expired' | 'no_refresh' | 'never_expires' | 'error'
  message: string
  daysRemaining?: number
}

const NEVER_EXPIRES = new Set(['twitter', 'facebook'])

function getEnv(key: string): string | undefined {
  return process.env[key]
}

function updateEnvToken(envKey: string, newValue: string): void {
  const env = readFileSync(ENV_PATH, 'utf-8')
  const needle = `${envKey}="`
  const start = env.indexOf(needle)
  if (start === -1) return
  const valueStart = start + needle.length
  const valueEnd = env.indexOf('"', valueStart)
  if (valueEnd === -1) return
  writeFileSync(ENV_PATH, env.slice(0, valueStart) + newValue + env.slice(valueEnd))
}

// --- Instagram ---

async function refreshInstagram(brand: string): Promise<TokenStatus> {
  const envKey = `INSTAGRAM_${brand.toUpperCase()}_ACCESS_TOKEN`
  const token = getEnv(envKey)
  if (!token) return { platform: 'instagram', brand, status: 'error', message: 'No token configured' }

  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 400 && text.includes('expired')) {
      return { platform: 'instagram', brand, status: 'expired',
        message: 'Token expired. Re-auth: Meta Developer Console > Instagram > Generate access tokens' }
    }
    return { platform: 'instagram', brand, status: 'error', message: `Refresh failed: ${res.status}` }
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  updateEnvToken(envKey, data.access_token)
  process.env[envKey] = data.access_token
  const days = Math.round(data.expires_in / 86400)
  recordExpiry(envKey, days)
  return { platform: 'instagram', brand, status: 'refreshed', message: `Refreshed (${days}d)`, daysRemaining: days }
}

// --- Threads ---

async function refreshThreads(brand: string): Promise<TokenStatus> {
  const envKey = `THREADS_${brand.toUpperCase()}_ACCESS_TOKEN`
  const token = getEnv(envKey)
  if (!token) return { platform: 'threads', brand, status: 'error', message: 'No token configured' }

  const url = new URL('https://graph.threads.net/refresh_access_token')
  url.searchParams.set('grant_type', 'th_refresh_token')
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 400 && text.includes('expired')) {
      return { platform: 'threads', brand, status: 'expired',
        message: 'Token expired. Re-auth: Meta Developer Console > Threads > Generate access tokens' }
    }
    return { platform: 'threads', brand, status: 'error', message: `Refresh failed: ${res.status}` }
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  updateEnvToken(envKey, data.access_token)
  process.env[envKey] = data.access_token
  const days = Math.round(data.expires_in / 86400)
  recordExpiry(envKey, days)
  return { platform: 'threads', brand, status: 'refreshed', message: `Refreshed (${days}d)`, daysRemaining: days }
}

// --- LinkedIn (uses refresh_token grant) ---

async function refreshLinkedIn(brand: string): Promise<TokenStatus> {
  const brandUpper = brand.toUpperCase()
  const refreshToken = getEnv(`LINKEDIN_${brandUpper}_REFRESH_TOKEN`)
  const clientId = getEnv('LINKEDIN_CLIENT_ID')
  const clientSecret = getEnv('LINKEDIN_CLIENT_SECRET')

  if (!refreshToken) {
    return { platform: 'linkedin', brand, status: 'no_refresh',
      message: 'No refresh token. Run: npx tsx scripts/linkedin-auth.ts ' + brand }
  }
  if (!clientId || !clientSecret) {
    return { platform: 'linkedin', brand, status: 'error',
      message: 'Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET' }
  }

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })

  if (!res.ok) {
    const text = await res.text()
    if (text.includes('expired') || text.includes('revoked') || text.includes('invalid')) {
      return { platform: 'linkedin', brand, status: 'expired',
        message: 'Refresh token expired/revoked. Run: npx tsx scripts/linkedin-auth.ts ' + brand }
    }
    return { platform: 'linkedin', brand, status: 'error', message: `Refresh failed: ${res.status}` }
  }

  const data = await res.json() as {
    access_token: string; expires_in: number
    refresh_token?: string; refresh_token_expires_in?: number
  }

  // Update access token
  const accessKey = `LINKEDIN_${brandUpper}_ACCESS_TOKEN`
  updateEnvToken(accessKey, data.access_token)
  process.env[accessKey] = data.access_token
  const days = Math.round(data.expires_in / 86400)
  recordExpiry(accessKey, days)

  // Update refresh token if a new one was issued (rotation)
  if (data.refresh_token) {
    const refreshKey = `LINKEDIN_${brandUpper}_REFRESH_TOKEN`
    updateEnvToken(refreshKey, data.refresh_token)
    process.env[refreshKey] = data.refresh_token
  }

  return { platform: 'linkedin', brand, status: 'refreshed', message: `Refreshed (${days}d)`, daysRemaining: days }
}

// --- Set token (paste directly into .env) ---

const ENV_KEY_MAP: Record<string, string> = {
  instagram: 'INSTAGRAM_{BRAND}_ACCESS_TOKEN',
  threads: 'THREADS_{BRAND}_ACCESS_TOKEN',
  linkedin: 'LINKEDIN_{BRAND}_ACCESS_TOKEN',
}

const EXPIRY_DAYS: Record<string, number> = {
  instagram: 60,
  threads: 60,
  linkedin: 60,
}

export function setToken(platform: string, brand: string, token: string): string {
  const template = ENV_KEY_MAP[platform]
  if (!template) return `Unknown platform: ${platform}. Use: instagram, threads, linkedin`

  const envKey = template.replace('{BRAND}', brand.toUpperCase())

  // Read .env, find and replace or append
  let env = readFileSync(ENV_PATH, 'utf-8')
  const needle = `${envKey}="`
  const start = env.indexOf(needle)
  if (start !== -1) {
    const valueStart = start + needle.length
    const valueEnd = env.indexOf('"', valueStart)
    if (valueEnd !== -1) {
      env = env.slice(0, valueStart) + token + env.slice(valueEnd)
    }
  } else {
    env = env.trimEnd() + `\n${envKey}="${token}"\n`
  }
  writeFileSync(ENV_PATH, env)
  process.env[envKey] = token

  // Record expiry
  const days = EXPIRY_DAYS[platform] ?? 60
  recordExpiry(envKey, days)

  return `Set ${envKey} (expires in ${days}d). Run 'token check ${brand}' to verify.`
}

// --- Probes (lightweight token validity checks) ---

async function probeInstagram(brand: string): Promise<{ valid: boolean }> {
  const token = getEnv(`INSTAGRAM_${brand.toUpperCase()}_ACCESS_TOKEN`)
  if (!token) return { valid: false }
  const res = await fetch(`https://graph.instagram.com/me?fields=id&access_token=${token}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  return { valid: res.ok }
}

async function probeThreads(brand: string): Promise<{ valid: boolean }> {
  const token = getEnv(`THREADS_${brand.toUpperCase()}_ACCESS_TOKEN`)
  if (!token) return { valid: false }
  const res = await fetch(`https://graph.threads.net/me?fields=id&access_token=${token}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
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

// --- Public API ---

export async function checkTokens(brand: string): Promise<TokenStatus[]> {
  const brandUpper = brand.toUpperCase()
  const results: TokenStatus[] = []

  if (getEnv(`TWITTER_${brandUpper}_API_KEY`))
    results.push({ platform: 'twitter', brand, status: 'never_expires', message: 'OAuth 1.0a tokens never expire' })

  if (getEnv(`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`))
    results.push({ platform: 'facebook', brand, status: 'never_expires', message: 'Page tokens never expire' })

  for (const [platform, probe] of [
    ['instagram', probeInstagram],
    ['threads', probeThreads],
    ['linkedin', probeLinkedIn]
  ] as const) {
    const envKey = platform === 'linkedin'
      ? `LINKEDIN_${brandUpper}_ACCESS_TOKEN`
      : `${platform.toUpperCase()}_${brandUpper}_ACCESS_TOKEN`
    if (!getEnv(envKey)) continue

    const { valid } = await probe(brand)
    const days = getDaysRemaining(envKey)
    if (valid) {
      const msg = days !== undefined ? `Token valid (${days}d remaining)` : 'Token valid'
      results.push({ platform, brand, status: 'ok', message: msg, daysRemaining: days })
    } else {
      results.push({ platform, brand, status: 'expired', message: 'Token expired or invalid' })
    }
  }

  return results
}

export async function refreshTokens(brand: string, force = false): Promise<TokenStatus[]> {
  const brandUpper = brand.toUpperCase()
  const results: TokenStatus[] = []

  // Instagram
  if (getEnv(`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`)) {
    if (force || (await probeInstagram(brand)).valid) {
      results.push(await refreshInstagram(brand))
    } else {
      results.push({ platform: 'instagram', brand, status: 'expired',
        message: 'Token expired. Re-auth: Meta Developer Console' })
    }
  }

  // Threads
  if (getEnv(`THREADS_${brandUpper}_ACCESS_TOKEN`)) {
    if (force || (await probeThreads(brand)).valid) {
      results.push(await refreshThreads(brand))
    } else {
      results.push({ platform: 'threads', brand, status: 'expired',
        message: 'Token expired. Re-auth: Meta Developer Console' })
    }
  }

  // LinkedIn — use refresh_token if available
  if (getEnv(`LINKEDIN_${brandUpper}_ACCESS_TOKEN`)) {
    if (getEnv(`LINKEDIN_${brandUpper}_REFRESH_TOKEN`)) {
      results.push(await refreshLinkedIn(brand))
    } else {
      const { valid } = await probeLinkedIn(brand)
      results.push(valid
        ? { platform: 'linkedin', brand, status: 'ok', message: 'Valid (no refresh token — add one via linkedin-auth.ts)' }
        : { platform: 'linkedin', brand, status: 'no_refresh',
            message: 'Expired, no refresh token. Run: npx tsx scripts/linkedin-auth.ts ' + brand })
    }
  }

  return results
}

export async function preflightTokenCheck(
  brand: string,
  platforms: string[]
): Promise<{ ready: string[]; failed: TokenStatus[] }> {
  const ready: string[] = []
  const failed: TokenStatus[] = []

  for (const platform of platforms) {
    if (NEVER_EXPIRES.has(platform)) { ready.push(platform); continue }

    let valid = false
    if (platform === 'instagram') valid = (await probeInstagram(brand)).valid
    else if (platform === 'threads') valid = (await probeThreads(brand)).valid
    else if (platform === 'linkedin') valid = (await probeLinkedIn(brand)).valid
    else { ready.push(platform); continue }

    if (valid) { ready.push(platform); continue }

    // Try refresh
    let result: TokenStatus
    if (platform === 'instagram') result = await refreshInstagram(brand)
    else if (platform === 'threads') result = await refreshThreads(brand)
    else if (platform === 'linkedin') result = await refreshLinkedIn(brand)
    else continue

    if (result.status === 'refreshed') {
      console.log(`[token] Refreshed ${platform}/${brand}`)
      ready.push(platform)
    } else {
      failed.push(result)
    }
  }

  return { ready, failed }
}
