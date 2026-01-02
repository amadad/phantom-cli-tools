#!/usr/bin/env npx tsx
/**
 * Outlier Detection - Find viral content using multiplier formula
 *
 * Formula: outlier_tier = max(k for k in [5, 10, 50, 100] if views >= k * median)
 *
 * Usage:
 *   npx tsx detect-outliers.ts givecare [--min-multiplier=10] [--max-age-days=3]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export type OutlierTier = 5 | 10 | 50 | 100

export interface ContentPost {
  id: string
  url: string
  platform: string
  authorUsername: string
  authorFollowers: number
  views: number
  likes: number
  comments: number
  shares?: number
  caption: string
  postedAt: string
  scrapedAt: string
}

export interface ContentOutlier {
  post: ContentPost
  multiplier: OutlierTier
  medianAccountViews: number
  capturedAt: string
  analyzed: boolean
  hookExtracted?: boolean
}

export interface OutlierDatabase {
  brand: string
  lastUpdated: string
  outliers: ContentOutlier[]
  stats: {
    total: number
    by100x: number
    by50x: number
    by10x: number
    by5x: number
    analyzed: number
  }
}

const MULTIPLIER_TIERS: OutlierTier[] = [100, 50, 10, 5]

/**
 * Detect outlier tier for a post given account median views
 */
export function detectOutlierTier(views: number, medianViews: number): OutlierTier | null {
  for (const k of MULTIPLIER_TIERS) {
    if (views >= k * medianViews) {
      return k
    }
  }
  return null
}

/**
 * Calculate median from array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function getOutlierDbPath(brand: string): string {
  return join(__dirname, 'data', `${brand}-outliers.json`)
}

export function loadOutlierDb(brand: string): OutlierDatabase {
  const path = getOutlierDbPath(brand)

  if (!existsSync(path)) {
    return {
      brand,
      lastUpdated: new Date().toISOString(),
      outliers: [],
      stats: { total: 0, by100x: 0, by50x: 0, by10x: 0, by5x: 0, analyzed: 0 }
    }
  }

  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function saveOutlierDb(db: OutlierDatabase): void {
  const path = getOutlierDbPath(db.brand)
  const dir = dirname(path)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Update stats
  db.stats = {
    total: db.outliers.length,
    by100x: db.outliers.filter(o => o.multiplier === 100).length,
    by50x: db.outliers.filter(o => o.multiplier === 50).length,
    by10x: db.outliers.filter(o => o.multiplier === 10).length,
    by5x: db.outliers.filter(o => o.multiplier === 5).length,
    analyzed: db.outliers.filter(o => o.analyzed).length
  }

  db.lastUpdated = new Date().toISOString()
  writeFileSync(path, JSON.stringify(db, null, 2))
}

/**
 * Add outlier to database (deduplicates by post URL)
 */
export function addOutlier(
  brand: string,
  post: ContentPost,
  medianViews: number
): ContentOutlier | null {
  const tier = detectOutlierTier(post.views, medianViews)
  if (!tier) return null

  const db = loadOutlierDb(brand)

  // Check for duplicate
  if (db.outliers.some(o => o.post.url === post.url)) {
    return null
  }

  const outlier: ContentOutlier = {
    post,
    multiplier: tier,
    medianAccountViews: medianViews,
    capturedAt: new Date().toISOString(),
    analyzed: false
  }

  db.outliers.push(outlier)
  saveOutlierDb(db)

  return outlier
}

/**
 * Get outliers prioritized by multiplier (100x first)
 */
export function getOutliersByPriority(
  brand: string,
  options: {
    minMultiplier?: OutlierTier
    unanalyzedOnly?: boolean
    limit?: number
    maxAgeDays?: number
  } = {}
): ContentOutlier[] {
  const db = loadOutlierDb(brand)
  let results = db.outliers

  if (options.minMultiplier) {
    results = results.filter(o => o.multiplier >= options.minMultiplier!)
  }

  if (options.unanalyzedOnly) {
    results = results.filter(o => !o.analyzed)
  }

  if (options.maxAgeDays) {
    const cutoff = Date.now() - options.maxAgeDays * 24 * 60 * 60 * 1000
    results = results.filter(o => new Date(o.post.postedAt).getTime() > cutoff)
  }

  // Sort by multiplier desc, then by views desc
  results.sort((a, b) => {
    if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier
    return b.post.views - a.post.views
  })

  if (options.limit) {
    results = results.slice(0, options.limit)
  }

  return results
}

/**
 * Mark outlier as analyzed (hook extracted)
 */
export function markOutlierAnalyzed(brand: string, postUrl: string): void {
  const db = loadOutlierDb(brand)
  const outlier = db.outliers.find(o => o.post.url === postUrl)

  if (outlier) {
    outlier.analyzed = true
    outlier.hookExtracted = true
    saveOutlierDb(db)
  }
}

/**
 * Process posts from enrichment and detect outliers
 */
export function processPostsForOutliers(
  brand: string,
  posts: ContentPost[],
  accountMedians: Map<string, number>
): ContentOutlier[] {
  const newOutliers: ContentOutlier[] = []

  for (const post of posts) {
    const median = accountMedians.get(post.authorUsername)
    if (!median) continue

    const outlier = addOutlier(brand, post, median)
    if (outlier) {
      newOutliers.push(outlier)
      console.log(`  [${outlier.multiplier}x] ${post.authorUsername}: ${post.views.toLocaleString()} views (median: ${median.toLocaleString()})`)
    }
  }

  return newOutliers
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args[0] || 'givecare'
  const minMultiplierArg = args.find(a => a.startsWith('--min-multiplier='))
  const maxAgeDaysArg = args.find(a => a.startsWith('--max-age-days='))
  const unanalyzedOnly = args.includes('--unanalyzed')

  const minMultiplier = minMultiplierArg
    ? parseInt(minMultiplierArg.split('=')[1]) as OutlierTier
    : undefined
  const maxAgeDays = maxAgeDaysArg
    ? parseInt(maxAgeDaysArg.split('=')[1])
    : 3

  console.log(`\n${'='.repeat(60)}`)
  console.log(`OUTLIER DETECTION: ${brand.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  const db = loadOutlierDb(brand)
  console.log(`\nDatabase stats:`)
  console.log(`  Total outliers: ${db.stats.total}`)
  console.log(`  100x: ${db.stats.by100x} | 50x: ${db.stats.by50x} | 10x: ${db.stats.by10x} | 5x: ${db.stats.by5x}`)
  console.log(`  Analyzed: ${db.stats.analyzed}`)

  const outliers = getOutliersByPriority(brand, {
    minMultiplier,
    unanalyzedOnly,
    maxAgeDays,
    limit: 20
  })

  if (outliers.length === 0) {
    console.log('\nNo outliers found matching criteria.')
    console.log('\nTo add outliers, run enrich-apify.ts with --include-posts flag')
    return
  }

  console.log(`\nTop outliers (${outliers.length}):`)
  console.log()

  for (const o of outliers) {
    const status = o.analyzed ? '✓' : '○'
    console.log(`${status} [${o.multiplier}x] @${o.post.authorUsername}`)
    console.log(`  ${o.post.views.toLocaleString()} views | ${o.post.likes.toLocaleString()} likes`)
    console.log(`  ${o.post.caption.slice(0, 80)}...`)
    console.log(`  ${o.post.url}`)
    console.log()
  }

  // Show priority order
  const unanalyzed = outliers.filter(o => !o.analyzed)
  if (unanalyzed.length > 0) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`PRIORITY: Analyze these ${unanalyzed.length} outliers next`)
    console.log(`${'─'.repeat(60)}`)
    for (const o of unanalyzed.slice(0, 5)) {
      console.log(`  [${o.multiplier}x] ${o.post.url}`)
    }
  }
}

main().catch(console.error)
