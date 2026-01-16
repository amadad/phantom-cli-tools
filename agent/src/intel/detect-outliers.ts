#!/usr/bin/env npx tsx
/**
 * Outlier Detection - Find viral content using multiplier formula
 *
 * Formula: outlier_tier = max(k for k in [5, 10, 50, 100] if views >= k * median)
 *
 * Usage:
 *   npx tsx detect-outliers.ts <brand> [--min-multiplier=10] [--max-age-days=3]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getIntelPath, ensureIntelDir } from './paths'
import { getDefaultBrand } from '../core/paths'

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
  return getIntelPath(brand, 'outliers.json')
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
  ensureIntelDir(db.brand)

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

/**
 * Scan influencer database for posts and detect outliers
 * @param maxAgeDays - Only consider posts from the last N days (default: 7)
 */
function scanInfluencerPosts(brand: string, maxAgeDays: number = 7): number {
  const influencerDbPath = getIntelPath(brand, 'influencers.json')
  const ageCutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

  if (!existsSync(influencerDbPath)) {
    console.log('  No influencer database found')
    return 0
  }

  const influencerDb = JSON.parse(readFileSync(influencerDbPath, 'utf-8'))
  const allInfluencers = [...(influencerDb.influencers || []), ...(influencerDb.organizations || [])]

  let newOutliers = 0

  for (const influencer of allInfluencers) {
    for (const handle of influencer.handles || []) {
      const posts = handle.recentPosts
      const medianViews = handle.medianViews

      if (!posts || !medianViews || posts.length === 0) continue

      for (const post of posts) {
        // Skip posts older than cutoff
        const postDate = new Date(post.postedAt || 0).getTime()
        if (postDate < ageCutoff) {
          continue
        }

        // Platform-specific likes→views multiplier (Twitter ~50x, Instagram ~10x)
        const likesMultiplier = handle.platform === 'twitter' ? 50 : 10
        const views = post.views || post.likes * likesMultiplier

        // Build ContentPost
        const defaultUrl = handle.platform === 'twitter'
          ? `https://twitter.com/${handle.username}/status/${post.id}`
          : `https://instagram.com/p/${post.id}`
        const contentPost: ContentPost = {
          id: post.id || `${handle.username}-${Date.now()}`,
          url: post.url || defaultUrl,
          platform: handle.platform,
          authorUsername: handle.username,
          authorFollowers: handle.followers || 0,
          views,
          likes: post.likes || 0,
          comments: post.comments || 0,
          shares: post.shares,
          caption: post.caption || '',
          postedAt: post.postedAt || new Date().toISOString(),
          scrapedAt: new Date().toISOString()
        }

        const outlier = addOutlier(brand, contentPost, medianViews)
        if (outlier) {
          newOutliers++
          console.log(`  [${outlier.multiplier}x] @${handle.username}: ${views.toLocaleString()} views (median: ${medianViews.toLocaleString()})`)
        }
      }
    }
  }

  return newOutliers
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args[0] || getDefaultBrand()
  const minMultiplierArg = args.find(a => a.startsWith('--min-multiplier='))
  const maxAgeDaysArg = args.find(a => a.startsWith('--max-age-days='))
  const unanalyzedOnly = args.includes('--unanalyzed')
  const doScan = args.includes('--scan') || !existsSync(getOutlierDbPath(brand))

  const minMultiplier = minMultiplierArg
    ? parseInt(minMultiplierArg.split('=')[1]) as OutlierTier
    : undefined
  const maxAgeDays = maxAgeDaysArg
    ? parseInt(maxAgeDaysArg.split('=')[1])
    : 7  // Default: only last 7 days (per viral playbook)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`OUTLIER DETECTION: ${brand.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  // Scan influencer posts if requested or if no outlier DB exists
  if (doScan) {
    console.log(`\nScanning influencer posts for outliers (max ${maxAgeDays} days old)...`)
    const found = scanInfluencerPosts(brand, maxAgeDays)
    console.log(`\nFound ${found} new outliers`)
  }

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
    console.log('\nTo add outliers, run: npx tsx enrich-apify.ts <brand> --include-posts')
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
    console.log(`Run: npx tsx extract-hooks.ts ${brand}`)
    console.log(`${'─'.repeat(60)}`)
    for (const o of unanalyzed.slice(0, 5)) {
      console.log(`  [${o.multiplier}x] ${o.post.url}`)
    }
  }
}

const isDirect = process.argv[1]?.endsWith('detect-outliers.ts')
if (isDirect) {
  main().catch(console.error)
}
