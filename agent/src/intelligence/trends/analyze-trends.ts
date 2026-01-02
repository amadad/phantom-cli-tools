#!/usr/bin/env npx tsx
/**
 * Analyze trends across snapshots
 * Usage: npx tsx analyze-trends.ts [brand] [--period=30] [--output=json]
 *
 * Compares current state to historical snapshots to identify:
 * - Growing/declining themes
 * - Influencer growth trajectories
 * - Platform shifts
 * - Emerging voices
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Snapshot {
  brand: string
  timestamp: string
  dateKey: string
  totals: {
    influencers: number
    organizations: number
    totalFollowers: number
    avgRelevanceScore: number
  }
  platforms: { platform: string; count: number; totalFollowers: number }[]
  themes: { theme: string; count: number; percentage: number }[]
  topInfluencers: {
    id: string
    name: string
    followers: number
    platform: string
    relevanceScore?: number
  }[]
  newAdditions: string[]
}

interface TrendAnalysis {
  brand: string
  analyzedAt: string
  period: {
    start: string
    end: string
    days: number
    snapshotCount: number
  }

  // Overall growth
  growth: {
    influencerCount: { start: number; end: number; change: number; percentChange: number }
    totalReach: { start: number; end: number; change: number; percentChange: number }
    avgRelevance: { start: number; end: number; change: number }
  }

  // Theme trends
  themesTrending: {
    theme: string
    direction: 'rising' | 'falling' | 'stable'
    startPercentage: number
    endPercentage: number
    change: number
  }[]

  // Platform trends
  platformTrends: {
    platform: string
    direction: 'rising' | 'falling' | 'stable'
    startCount: number
    endCount: number
    change: number
  }[]

  // Influencer growth leaders
  growthLeaders: {
    id: string
    name: string
    platform: string
    startFollowers: number
    endFollowers: number
    growth: number
    growthPercent: number
  }[]

  // New entrants with high impact
  risingStars: {
    id: string
    name: string
    followers: number
    platform: string
    addedDate: string
  }[]

  // Alerts
  alerts: {
    type: 'new_major_influencer' | 'viral_growth' | 'theme_shift' | 'platform_decline'
    severity: 'high' | 'medium' | 'low'
    message: string
    data?: any
  }[]
}

function loadSnapshots(brand: string): Snapshot[] {
  const snapshotsDir = join(__dirname, '..', 'data', 'snapshots')
  if (!existsSync(snapshotsDir)) return []

  const files = readdirSync(snapshotsDir)
    .filter(f => f.startsWith(`${brand}-`) && f.endsWith('.json'))
    .sort()

  return files.map(f => {
    const filepath = join(snapshotsDir, f)
    return JSON.parse(readFileSync(filepath, 'utf-8')) as Snapshot
  })
}

function analyzeTrends(snapshots: Snapshot[], periodDays: number): TrendAnalysis | null {
  if (snapshots.length < 2) {
    console.log('Need at least 2 snapshots for trend analysis')
    return null
  }

  const now = new Date()
  const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

  // Filter to period
  const periodSnapshots = snapshots.filter(s => new Date(s.timestamp) >= cutoffDate)
  if (periodSnapshots.length < 2) {
    // Use all available if period too short
    periodSnapshots.push(...snapshots.slice(-2))
  }

  const first = periodSnapshots[0]
  const last = periodSnapshots[periodSnapshots.length - 1]
  const brand = last.brand

  // Calculate growth
  const influencerChange = last.totals.influencers - first.totals.influencers
  const reachChange = last.totals.totalFollowers - first.totals.totalFollowers

  const growth = {
    influencerCount: {
      start: first.totals.influencers,
      end: last.totals.influencers,
      change: influencerChange,
      percentChange: first.totals.influencers > 0
        ? Math.round((influencerChange / first.totals.influencers) * 100)
        : 0
    },
    totalReach: {
      start: first.totals.totalFollowers,
      end: last.totals.totalFollowers,
      change: reachChange,
      percentChange: first.totals.totalFollowers > 0
        ? Math.round((reachChange / first.totals.totalFollowers) * 100)
        : 0
    },
    avgRelevance: {
      start: first.totals.avgRelevanceScore,
      end: last.totals.avgRelevanceScore,
      change: Math.round((last.totals.avgRelevanceScore - first.totals.avgRelevanceScore) * 10) / 10
    }
  }

  // Theme trends
  const firstThemes = new Map(first.themes.map(t => [t.theme, t.percentage]))
  const lastThemes = new Map(last.themes.map(t => [t.theme, t.percentage]))

  const allThemes = new Set([...firstThemes.keys(), ...lastThemes.keys()])
  const themesTrending: TrendAnalysis['themesTrending'] = []

  for (const theme of allThemes) {
    const startPct = firstThemes.get(theme) || 0
    const endPct = lastThemes.get(theme) || 0
    const change = endPct - startPct

    let direction: 'rising' | 'falling' | 'stable' = 'stable'
    if (change >= 5) direction = 'rising'
    else if (change <= -5) direction = 'falling'

    themesTrending.push({
      theme,
      direction,
      startPercentage: startPct,
      endPercentage: endPct,
      change
    })
  }

  themesTrending.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  // Platform trends
  const firstPlatforms = new Map(first.platforms.map(p => [p.platform, p.count]))
  const lastPlatforms = new Map(last.platforms.map(p => [p.platform, p.count]))

  const allPlatforms = new Set([...firstPlatforms.keys(), ...lastPlatforms.keys()])
  const platformTrends: TrendAnalysis['platformTrends'] = []

  for (const platform of allPlatforms) {
    const startCount = firstPlatforms.get(platform) || 0
    const endCount = lastPlatforms.get(platform) || 0
    const change = endCount - startCount

    let direction: 'rising' | 'falling' | 'stable' = 'stable'
    if (change >= 2) direction = 'rising'
    else if (change <= -2) direction = 'falling'

    platformTrends.push({
      platform,
      direction,
      startCount,
      endCount,
      change
    })
  }

  platformTrends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  // Influencer growth tracking
  const firstInfluencers = new Map(first.topInfluencers.map(i => [i.id, i]))
  const lastInfluencers = new Map(last.topInfluencers.map(i => [i.id, i]))

  const growthLeaders: TrendAnalysis['growthLeaders'] = []

  for (const [id, lastInf] of lastInfluencers) {
    const firstInf = firstInfluencers.get(id)
    if (firstInf && firstInf.followers > 0) {
      const growth = lastInf.followers - firstInf.followers
      const growthPercent = Math.round((growth / firstInf.followers) * 100)

      if (growth > 0) {
        growthLeaders.push({
          id,
          name: lastInf.name,
          platform: lastInf.platform,
          startFollowers: firstInf.followers,
          endFollowers: lastInf.followers,
          growth,
          growthPercent
        })
      }
    }
  }

  growthLeaders.sort((a, b) => b.growthPercent - a.growthPercent)

  // Rising stars (new high-follower additions)
  const risingStars: TrendAnalysis['risingStars'] = []
  const allNewAdditions = new Set<string>()

  for (const snapshot of periodSnapshots) {
    for (const id of snapshot.newAdditions) {
      allNewAdditions.add(id)
    }
  }

  for (const id of allNewAdditions) {
    const inf = last.topInfluencers.find(i => i.id === id)
    if (inf && inf.followers > 50000) {
      risingStars.push({
        id,
        name: inf.name,
        followers: inf.followers,
        platform: inf.platform,
        addedDate: periodSnapshots.find(s => s.newAdditions.includes(id))?.dateKey || 'unknown'
      })
    }
  }

  risingStars.sort((a, b) => b.followers - a.followers)

  // Generate alerts
  const alerts: TrendAnalysis['alerts'] = []

  // Alert: New major influencer (100K+)
  for (const star of risingStars) {
    if (star.followers >= 100000) {
      alerts.push({
        type: 'new_major_influencer',
        severity: 'high',
        message: `New major influencer: ${star.name} (${(star.followers / 1000).toFixed(0)}K on ${star.platform})`,
        data: star
      })
    }
  }

  // Alert: Viral growth (>50% in period)
  for (const leader of growthLeaders.slice(0, 3)) {
    if (leader.growthPercent >= 50) {
      alerts.push({
        type: 'viral_growth',
        severity: 'high',
        message: `${leader.name} grew ${leader.growthPercent}% (${leader.growth.toLocaleString()} new followers)`,
        data: leader
      })
    }
  }

  // Alert: Theme shifts
  for (const theme of themesTrending.slice(0, 2)) {
    if (theme.direction === 'rising' && theme.change >= 10) {
      alerts.push({
        type: 'theme_shift',
        severity: 'medium',
        message: `"${theme.theme}" content rising: ${theme.startPercentage}% → ${theme.endPercentage}%`,
        data: theme
      })
    }
  }

  // Alert: Platform decline
  for (const platform of platformTrends) {
    if (platform.direction === 'falling' && platform.change <= -3) {
      alerts.push({
        type: 'platform_decline',
        severity: 'low',
        message: `${platform.platform} presence declining: ${platform.startCount} → ${platform.endCount}`,
        data: platform
      })
    }
  }

  return {
    brand,
    analyzedAt: now.toISOString(),
    period: {
      start: first.dateKey,
      end: last.dateKey,
      days: Math.round((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (24 * 60 * 60 * 1000)),
      snapshotCount: periodSnapshots.length
    },
    growth,
    themesTrending,
    platformTrends,
    growthLeaders: growthLeaders.slice(0, 10),
    risingStars: risingStars.slice(0, 5),
    alerts
  }
}

function printAnalysis(analysis: TrendAnalysis) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TREND ANALYSIS: ${analysis.brand.toUpperCase()}`)
  console.log(`Period: ${analysis.period.start} → ${analysis.period.end} (${analysis.period.days} days)`)
  console.log(`Snapshots analyzed: ${analysis.period.snapshotCount}`)
  console.log(`${'='.repeat(60)}`)

  // Alerts first
  if (analysis.alerts.length > 0) {
    console.log('\n## ALERTS')
    for (const alert of analysis.alerts) {
      const icon = alert.severity === 'high' ? '!!' : alert.severity === 'medium' ? '!' : '-'
      console.log(`  [${icon}] ${alert.message}`)
    }
  }

  // Growth summary
  console.log('\n## Growth Summary')
  const g = analysis.growth
  console.log(`  Influencers: ${g.influencerCount.start} → ${g.influencerCount.end} (${g.influencerCount.change >= 0 ? '+' : ''}${g.influencerCount.change})`)
  console.log(`  Total Reach: ${g.totalReach.start.toLocaleString()} → ${g.totalReach.end.toLocaleString()} (${g.totalReach.percentChange >= 0 ? '+' : ''}${g.totalReach.percentChange}%)`)
  console.log(`  Avg Relevance: ${g.avgRelevance.start} → ${g.avgRelevance.end}`)

  // Theme trends
  const risingThemes = analysis.themesTrending.filter(t => t.direction === 'rising')
  const fallingThemes = analysis.themesTrending.filter(t => t.direction === 'falling')

  if (risingThemes.length > 0 || fallingThemes.length > 0) {
    console.log('\n## Theme Trends')
    for (const t of risingThemes.slice(0, 3)) {
      console.log(`  ↑ ${t.theme}: ${t.startPercentage}% → ${t.endPercentage}% (+${t.change})`)
    }
    for (const t of fallingThemes.slice(0, 3)) {
      console.log(`  ↓ ${t.theme}: ${t.startPercentage}% → ${t.endPercentage}% (${t.change})`)
    }
  }

  // Platform trends
  const risingPlatforms = analysis.platformTrends.filter(p => p.direction === 'rising')
  const fallingPlatforms = analysis.platformTrends.filter(p => p.direction === 'falling')

  if (risingPlatforms.length > 0 || fallingPlatforms.length > 0) {
    console.log('\n## Platform Trends')
    for (const p of risingPlatforms.slice(0, 3)) {
      console.log(`  ↑ ${p.platform}: ${p.startCount} → ${p.endCount} (+${p.change})`)
    }
    for (const p of fallingPlatforms.slice(0, 3)) {
      console.log(`  ↓ ${p.platform}: ${p.startCount} → ${p.endCount} (${p.change})`)
    }
  }

  // Growth leaders
  if (analysis.growthLeaders.length > 0) {
    console.log('\n## Fastest Growing')
    for (const leader of analysis.growthLeaders.slice(0, 5)) {
      console.log(`  ${leader.name}: +${leader.growthPercent}% (+${leader.growth.toLocaleString()}) on ${leader.platform}`)
    }
  }

  // Rising stars
  if (analysis.risingStars.length > 0) {
    console.log('\n## Rising Stars (New High-Impact)')
    for (const star of analysis.risingStars) {
      console.log(`  ${star.name}: ${(star.followers / 1000).toFixed(0)}K on ${star.platform} (added ${star.addedDate})`)
    }
  }
}

function saveAnalysis(analysis: TrendAnalysis): string {
  const outputDir = join(__dirname, 'data')
  const filename = `${analysis.brand}-trends.json`
  const filepath = join(outputDir, filename)

  writeFileSync(filepath, JSON.stringify(analysis, null, 2))
  return filepath
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args.find(a => !a.startsWith('--')) || 'givecare'
  const periodArg = args.find(a => a.startsWith('--period='))
  const period = periodArg ? parseInt(periodArg.split('=')[1]) : 30
  const outputJson = args.includes('--output=json')

  const snapshots = loadSnapshots(brand)

  if (snapshots.length === 0) {
    console.log(`No snapshots found for ${brand}`)
    console.log('Run: npx tsx track-snapshot.ts to create the first snapshot')
    process.exit(1)
  }

  if (snapshots.length === 1) {
    console.log(`Only 1 snapshot found. Need at least 2 for trend analysis.`)
    console.log('Run: npx tsx track-snapshot.ts again after some time has passed')
    process.exit(1)
  }

  const analysis = analyzeTrends(snapshots, period)
  if (!analysis) process.exit(1)

  if (outputJson) {
    console.log(JSON.stringify(analysis, null, 2))
  } else {
    printAnalysis(analysis)
    const filepath = saveAnalysis(analysis)
    console.log(`\nAnalysis saved: ${filepath}`)
  }
}

main().catch(console.error)
