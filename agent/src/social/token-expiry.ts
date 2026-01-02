#!/usr/bin/env npx tsx
/**
 * Token Expiry Tracking
 *
 * Tracks OAuth token expiry dates and warns before they expire.
 *
 * Usage:
 *   npx tsx token-expiry.ts check         # Check all tokens
 *   npx tsx token-expiry.ts set linkedin 2026-03-01  # Set expiry date
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '..', '..', '.env') })

interface TokenInfo {
  platform: string
  brand: string
  expiresAt?: string
  lastChecked: string
  status: 'ok' | 'expiring_soon' | 'expired' | 'never_expires' | 'unknown'
  daysRemaining?: number
}

interface TokenDatabase {
  lastUpdated: string
  tokens: TokenInfo[]
}

const TOKEN_DB_PATH = join(__dirname, '..', '..', 'data', 'token-expiry.json')

// Token lifetime by platform (days)
const TOKEN_LIFETIMES: Record<string, number | null> = {
  twitter: null,      // OAuth 1.0a - never expires
  linkedin: 60,       // OAuth 2.0 - ~60 days
  facebook: 60,       // Page access tokens - ~60 days
  instagram: 60,      // Platform API - ~60 days
  threads: 60,        // Threads API - ~60 days
  youtube: null       // Auto-refreshes via refresh_token
}

const WARN_DAYS = 7

function loadTokenDb(): TokenDatabase {
  if (!existsSync(TOKEN_DB_PATH)) {
    return { lastUpdated: new Date().toISOString(), tokens: [] }
  }
  return JSON.parse(readFileSync(TOKEN_DB_PATH, 'utf-8'))
}

function saveTokenDb(db: TokenDatabase): void {
  const dir = dirname(TOKEN_DB_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  db.lastUpdated = new Date().toISOString()
  writeFileSync(TOKEN_DB_PATH, JSON.stringify(db, null, 2))
}

function getTokenStatus(expiresAt: string | undefined): { status: TokenInfo['status']; daysRemaining?: number } {
  if (!expiresAt) {
    return { status: 'unknown' }
  }

  const now = Date.now()
  const expiry = new Date(expiresAt).getTime()
  const daysRemaining = Math.floor((expiry - now) / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining }
  } else if (daysRemaining <= WARN_DAYS) {
    return { status: 'expiring_soon', daysRemaining }
  } else {
    return { status: 'ok', daysRemaining }
  }
}

export function checkTokenExpiry(platform: string, brand: string): TokenInfo {
  const db = loadTokenDb()
  const token = db.tokens.find(t => t.platform === platform && t.brand === brand)

  const lifetime = TOKEN_LIFETIMES[platform]

  if (lifetime === null) {
    return {
      platform,
      brand,
      lastChecked: new Date().toISOString(),
      status: 'never_expires'
    }
  }

  if (!token?.expiresAt) {
    return {
      platform,
      brand,
      lastChecked: new Date().toISOString(),
      status: 'unknown'
    }
  }

  const { status, daysRemaining } = getTokenStatus(token.expiresAt)

  return {
    platform,
    brand,
    expiresAt: token.expiresAt,
    lastChecked: new Date().toISOString(),
    status,
    daysRemaining
  }
}

export function setTokenExpiry(platform: string, brand: string, expiresAt: string): void {
  const db = loadTokenDb()

  const existingIndex = db.tokens.findIndex(t => t.platform === platform && t.brand === brand)

  const { status, daysRemaining } = getTokenStatus(expiresAt)

  const tokenInfo: TokenInfo = {
    platform,
    brand,
    expiresAt,
    lastChecked: new Date().toISOString(),
    status,
    daysRemaining
  }

  if (existingIndex >= 0) {
    db.tokens[existingIndex] = tokenInfo
  } else {
    db.tokens.push(tokenInfo)
  }

  saveTokenDb(db)
}

export function checkAllTokens(): TokenInfo[] {
  const brands = ['givecare', 'scty']
  const platforms = Object.keys(TOKEN_LIFETIMES)

  const results: TokenInfo[] = []

  for (const brand of brands) {
    for (const platform of platforms) {
      // Check if we have credentials for this platform/brand combo
      const hasCredentials = checkHasCredentials(platform, brand)
      if (!hasCredentials) continue

      const info = checkTokenExpiry(platform, brand)
      results.push(info)
    }
  }

  return results
}

function checkHasCredentials(platform: string, brand: string): boolean {
  const brandUpper = brand.toUpperCase()

  switch (platform) {
    case 'twitter':
      return !!process.env[`TWITTER_${brandUpper}_API_KEY`]
    case 'linkedin':
      return !!process.env[`LINKEDIN_${brandUpper}_ACCESS_TOKEN`]
    case 'facebook':
      return !!process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`]
    case 'instagram':
      return !!process.env[`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`]
    case 'threads':
      return !!process.env[`THREADS_${brandUpper}_ACCESS_TOKEN`]
    case 'youtube':
      return !!process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`]
    default:
      return false
  }
}

export function getExpiringTokens(withinDays: number = WARN_DAYS): TokenInfo[] {
  const all = checkAllTokens()
  return all.filter(t =>
    t.status === 'expiring_soon' ||
    t.status === 'expired' ||
    (t.status === 'unknown' && TOKEN_LIFETIMES[t.platform] !== null)
  )
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'check'

  console.log(`\n${'='.repeat(60)}`)
  console.log('TOKEN EXPIRY TRACKER')
  console.log(`${'='.repeat(60)}`)

  if (command === 'check') {
    const tokens = checkAllTokens()

    console.log('\nConfigured tokens:\n')

    for (const token of tokens) {
      const icon =
        token.status === 'ok' ? '✓' :
        token.status === 'never_expires' ? '∞' :
        token.status === 'expiring_soon' ? '⚠' :
        token.status === 'expired' ? '✗' : '?'

      const days = token.daysRemaining !== undefined
        ? `(${token.daysRemaining} days)`
        : ''

      console.log(`${icon} ${token.platform}/${token.brand}: ${token.status} ${days}`)
    }

    const expiring = tokens.filter(t =>
      t.status === 'expiring_soon' || t.status === 'expired' || t.status === 'unknown'
    )

    if (expiring.length > 0) {
      console.log(`\n${'─'.repeat(60)}`)
      console.log('⚠ ACTION REQUIRED:')
      for (const t of expiring) {
        if (t.status === 'expired') {
          console.log(`  ✗ ${t.platform}/${t.brand}: EXPIRED - re-run ${t.platform}-auth.ts`)
        } else if (t.status === 'expiring_soon') {
          console.log(`  ⚠ ${t.platform}/${t.brand}: Expires in ${t.daysRemaining} days`)
        } else if (t.status === 'unknown') {
          console.log(`  ? ${t.platform}/${t.brand}: No expiry date set - run: npx tsx token-expiry.ts set ${t.platform} ${t.brand} YYYY-MM-DD`)
        }
      }
    }
  } else if (command === 'set') {
    const platform = args[1]
    const brand = args[2]
    const expiresAt = args[3]

    if (!platform || !brand || !expiresAt) {
      console.error('Usage: npx tsx token-expiry.ts set <platform> <brand> <YYYY-MM-DD>')
      process.exit(1)
    }

    setTokenExpiry(platform, brand, expiresAt)
    console.log(`\n✓ Set ${platform}/${brand} expiry to ${expiresAt}`)

    const info = checkTokenExpiry(platform, brand)
    console.log(`  Status: ${info.status}${info.daysRemaining !== undefined ? ` (${info.daysRemaining} days)` : ''}`)
  } else {
    console.error(`Unknown command: ${command}`)
    console.error('Usage: npx tsx token-expiry.ts [check|set]')
    process.exit(1)
  }
}

main().catch(console.error)
