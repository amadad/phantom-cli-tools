#!/usr/bin/env npx tsx
/**
 * Capture a snapshot of the influencer database for trend tracking
 * Usage: npx tsx track-snapshot.ts [brand]
 *
 * Run weekly (e.g., via cron) to build historical data
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface SocialHandle {
  platform: string
  username: string
  url: string
  followers?: number
  verified?: boolean
}

interface Influencer {
  id: string
  name: string
  type: string
  handles: SocialHandle[]
  metrics?: {
    totalFollowers?: number
    engagementRate?: number
    lastUpdated?: string
  }
  content?: {
    themes: string[]
  }
  strategy?: {
    relevanceScore?: number
  }
}

interface Database {
  brand: string
  lastUpdated: string
  influencers: Influencer[]
  organizations?: Influencer[]
  insights?: {
    topThemes: { theme: string; count: number }[]
    platformBreakdown: { platform: string; count: number }[]
  }
}

interface Snapshot {
  brand: string
  timestamp: string
  dateKey: string // YYYY-MM-DD for easy comparison

  // Aggregate metrics
  totals: {
    influencers: number
    organizations: number
    totalFollowers: number
    avgRelevanceScore: number
  }

  // Per-platform breakdown
  platforms: {
    platform: string
    count: number
    totalFollowers: number
  }[]

  // Theme prevalence
  themes: {
    theme: string
    count: number
    percentage: number
  }[]

  // Top influencers by followers (for tracking growth)
  topInfluencers: {
    id: string
    name: string
    followers: number
    platform: string
    relevanceScore?: number
  }[]

  // New additions since last snapshot
  newAdditions: string[]
}

function loadDatabase(brand: string): Database | null {
  const path = join(__dirname, '..', 'data', `${brand}-influencers.json`)
  if (!existsSync(path)) {
    console.error(`Database not found: ${path}`)
    return null
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function getLastSnapshot(brand: string): Snapshot | null {
  const snapshotsDir = join(__dirname, '..', 'data', 'snapshots')
  if (!existsSync(snapshotsDir)) return null

  const files = readdirSync(snapshotsDir)
    .filter(f => f.startsWith(`${brand}-`) && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length === 0) return null

  const latestFile = join(snapshotsDir, files[0])
  return JSON.parse(readFileSync(latestFile, 'utf-8'))
}

function createSnapshot(db: Database, lastSnapshot: Snapshot | null): Snapshot {
  const allInfluencers = [...db.influencers, ...(db.organizations || [])]
  const now = new Date()
  const dateKey = now.toISOString().split('T')[0]

  // Calculate totals
  let totalFollowers = 0
  let relevanceSum = 0
  let relevanceCount = 0

  for (const inf of allInfluencers) {
    if (inf.metrics?.totalFollowers) {
      totalFollowers += inf.metrics.totalFollowers
    } else {
      // Sum from handles if no total
      for (const h of inf.handles) {
        if (h.followers) totalFollowers += h.followers
      }
    }
    if (inf.strategy?.relevanceScore) {
      relevanceSum += inf.strategy.relevanceScore
      relevanceCount++
    }
  }

  // Platform breakdown
  const platformMap = new Map<string, { count: number; followers: number }>()
  for (const inf of allInfluencers) {
    for (const h of inf.handles) {
      const existing = platformMap.get(h.platform) || { count: 0, followers: 0 }
      existing.count++
      existing.followers += h.followers || 0
      platformMap.set(h.platform, existing)
    }
  }

  const platforms = Array.from(platformMap.entries())
    .map(([platform, data]) => ({
      platform,
      count: data.count,
      totalFollowers: data.followers
    }))
    .sort((a, b) => b.count - a.count)

  // Theme prevalence
  const themeMap = new Map<string, number>()
  for (const inf of allInfluencers) {
    for (const theme of inf.content?.themes || []) {
      themeMap.set(theme, (themeMap.get(theme) || 0) + 1)
    }
  }

  const themes = Array.from(themeMap.entries())
    .map(([theme, count]) => ({
      theme,
      count,
      percentage: Math.round((count / allInfluencers.length) * 100)
    }))
    .sort((a, b) => b.count - a.count)

  // Top influencers
  const topInfluencers: Snapshot['topInfluencers'] = []
  for (const inf of allInfluencers) {
    for (const h of inf.handles) {
      if (h.followers && h.followers > 10000) {
        topInfluencers.push({
          id: inf.id,
          name: inf.name,
          followers: h.followers,
          platform: h.platform,
          relevanceScore: inf.strategy?.relevanceScore
        })
      }
    }
  }
  topInfluencers.sort((a, b) => b.followers - a.followers)

  // Find new additions
  const lastIds = new Set(lastSnapshot?.topInfluencers.map(i => i.id) || [])
  const currentIds = allInfluencers.map(i => i.id)
  const newAdditions = lastSnapshot
    ? currentIds.filter(id => !lastIds.has(id))
    : []

  return {
    brand: db.brand,
    timestamp: now.toISOString(),
    dateKey,
    totals: {
      influencers: db.influencers.length,
      organizations: db.organizations?.length || 0,
      totalFollowers,
      avgRelevanceScore: relevanceCount > 0
        ? Math.round((relevanceSum / relevanceCount) * 10) / 10
        : 0
    },
    platforms,
    themes,
    topInfluencers: topInfluencers.slice(0, 20),
    newAdditions
  }
}

function saveSnapshot(snapshot: Snapshot): string {
  const snapshotsDir = join(__dirname, '..', 'data', 'snapshots')
  const filename = `${snapshot.brand}-${snapshot.dateKey}.json`
  const filepath = join(snapshotsDir, filename)

  writeFileSync(filepath, JSON.stringify(snapshot, null, 2))
  return filepath
}

function printSnapshot(snapshot: Snapshot, lastSnapshot: Snapshot | null) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`SNAPSHOT: ${snapshot.brand.toUpperCase()}`)
  console.log(`Date: ${snapshot.dateKey}`)
  console.log(`${'='.repeat(60)}`)

  console.log('\n## Totals')
  console.log(`  Influencers: ${snapshot.totals.influencers}`)
  console.log(`  Organizations: ${snapshot.totals.organizations}`)
  console.log(`  Total Reach: ${snapshot.totals.totalFollowers.toLocaleString()}`)
  console.log(`  Avg Relevance: ${snapshot.totals.avgRelevanceScore}/10`)

  if (lastSnapshot) {
    const followerChange = snapshot.totals.totalFollowers - lastSnapshot.totals.totalFollowers
    const infChange = snapshot.totals.influencers - lastSnapshot.totals.influencers
    console.log(`\n  Changes since ${lastSnapshot.dateKey}:`)
    if (infChange !== 0) {
      console.log(`    Influencers: ${infChange > 0 ? '+' : ''}${infChange}`)
    }
    if (followerChange !== 0) {
      console.log(`    Reach: ${followerChange > 0 ? '+' : ''}${followerChange.toLocaleString()}`)
    }
  }

  console.log('\n## Platforms')
  for (const p of snapshot.platforms.slice(0, 6)) {
    const followers = p.totalFollowers > 0
      ? ` (${(p.totalFollowers / 1000).toFixed(0)}K reach)`
      : ''
    console.log(`  ${p.platform}: ${p.count}${followers}`)
  }

  console.log('\n## Top Themes')
  for (const t of snapshot.themes.slice(0, 5)) {
    console.log(`  ${t.theme}: ${t.count} (${t.percentage}%)`)
  }

  console.log('\n## Top Influencers by Reach')
  for (const inf of snapshot.topInfluencers.slice(0, 5)) {
    console.log(`  ${inf.name}: ${(inf.followers / 1000).toFixed(0)}K (${inf.platform})`)
  }

  if (snapshot.newAdditions.length > 0) {
    console.log('\n## New Additions')
    for (const id of snapshot.newAdditions) {
      console.log(`  + ${id}`)
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args[0] || 'givecare'

  const db = loadDatabase(brand)
  if (!db) process.exit(1)

  const lastSnapshot = getLastSnapshot(brand)
  const snapshot = createSnapshot(db, lastSnapshot)

  printSnapshot(snapshot, lastSnapshot)

  const filepath = saveSnapshot(snapshot)
  console.log(`\nSnapshot saved: ${filepath}`)
}

main().catch(console.error)
