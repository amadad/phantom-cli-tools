#!/usr/bin/env npx tsx
/**
 * Generate a markdown trend report
 * Usage: npx tsx generate-report.ts [brand] [--slack]
 *
 * Creates a shareable report of trends and insights
 * Optionally posts to Slack if SLACK_BOT_TOKEN is set
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '..', '..', '..', '.env') })

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
  period: { start: string; end: string; days: number; snapshotCount: number }
  growth: {
    influencerCount: { start: number; end: number; change: number; percentChange: number }
    totalReach: { start: number; end: number; change: number; percentChange: number }
    avgRelevance: { start: number; end: number; change: number }
  }
  themesTrending: { theme: string; direction: string; startPercentage: number; endPercentage: number; change: number }[]
  platformTrends: { platform: string; direction: string; startCount: number; endCount: number; change: number }[]
  growthLeaders: { id: string; name: string; platform: string; startFollowers: number; endFollowers: number; growth: number; growthPercent: number }[]
  risingStars: { id: string; name: string; followers: number; platform: string; addedDate: string }[]
  alerts: { type: string; severity: string; message: string; data?: any }[]
}

function loadLatestSnapshot(brand: string): Snapshot | null {
  const snapshotsDir = join(__dirname, '..', 'data', 'snapshots')
  if (!existsSync(snapshotsDir)) return null

  const files = readdirSync(snapshotsDir)
    .filter(f => f.startsWith(`${brand}-`) && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length === 0) return null
  return JSON.parse(readFileSync(join(snapshotsDir, files[0]), 'utf-8'))
}

function loadTrends(brand: string): TrendAnalysis | null {
  const filepath = join(__dirname, 'data', `${brand}-trends.json`)
  if (!existsSync(filepath)) return null
  return JSON.parse(readFileSync(filepath, 'utf-8'))
}

function generateMarkdownReport(snapshot: Snapshot, trends: TrendAnalysis | null): string {
  const lines: string[] = []
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  lines.push(`# ${snapshot.brand.charAt(0).toUpperCase() + snapshot.brand.slice(1)} Social Intelligence Report`)
  lines.push(``)
  lines.push(`**Generated:** ${date}`)
  lines.push(``)

  // Executive Summary
  lines.push(`## Executive Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Influencers | ${snapshot.totals.influencers} |`)
  lines.push(`| Organizations | ${snapshot.totals.organizations} |`)
  lines.push(`| Combined Reach | ${snapshot.totals.totalFollowers.toLocaleString()} |`)
  lines.push(`| Avg Relevance Score | ${snapshot.totals.avgRelevanceScore}/10 |`)
  lines.push(``)

  // Alerts section
  if (trends && trends.alerts.length > 0) {
    lines.push(`## Alerts`)
    lines.push(``)
    for (const alert of trends.alerts) {
      const emoji = alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🔵'
      lines.push(`- ${emoji} ${alert.message}`)
    }
    lines.push(``)
  }

  // Trends section
  if (trends) {
    lines.push(`## Trends (${trends.period.days}-day period)`)
    lines.push(``)

    // Growth
    const g = trends.growth
    lines.push(`### Growth`)
    lines.push(``)
    lines.push(`| Metric | Start | End | Change |`)
    lines.push(`|--------|-------|-----|--------|`)
    lines.push(`| Influencers | ${g.influencerCount.start} | ${g.influencerCount.end} | ${g.influencerCount.change >= 0 ? '+' : ''}${g.influencerCount.change} |`)
    lines.push(`| Total Reach | ${g.totalReach.start.toLocaleString()} | ${g.totalReach.end.toLocaleString()} | ${g.totalReach.percentChange >= 0 ? '+' : ''}${g.totalReach.percentChange}% |`)
    lines.push(``)

    // Theme trends
    const risingThemes = trends.themesTrending.filter(t => t.direction === 'rising').slice(0, 3)
    const fallingThemes = trends.themesTrending.filter(t => t.direction === 'falling').slice(0, 3)

    if (risingThemes.length > 0 || fallingThemes.length > 0) {
      lines.push(`### Content Themes`)
      lines.push(``)
      if (risingThemes.length > 0) {
        lines.push(`**Rising:**`)
        for (const t of risingThemes) {
          lines.push(`- 📈 ${t.theme}: ${t.startPercentage}% → ${t.endPercentage}%`)
        }
      }
      if (fallingThemes.length > 0) {
        lines.push(``)
        lines.push(`**Declining:**`)
        for (const t of fallingThemes) {
          lines.push(`- 📉 ${t.theme}: ${t.startPercentage}% → ${t.endPercentage}%`)
        }
      }
      lines.push(``)
    }

    // Growth leaders
    if (trends.growthLeaders.length > 0) {
      lines.push(`### Fastest Growing Influencers`)
      lines.push(``)
      lines.push(`| Name | Platform | Growth |`)
      lines.push(`|------|----------|--------|`)
      for (const leader of trends.growthLeaders.slice(0, 5)) {
        lines.push(`| ${leader.name} | ${leader.platform} | +${leader.growthPercent}% |`)
      }
      lines.push(``)
    }

    // Rising stars
    if (trends.risingStars.length > 0) {
      lines.push(`### New High-Impact Additions`)
      lines.push(``)
      for (const star of trends.risingStars) {
        lines.push(`- **${star.name}** - ${(star.followers / 1000).toFixed(0)}K on ${star.platform}`)
      }
      lines.push(``)
    }
  }

  // Platform breakdown
  lines.push(`## Platform Breakdown`)
  lines.push(``)
  lines.push(`| Platform | Influencers | Reach |`)
  lines.push(`|----------|-------------|-------|`)
  for (const p of snapshot.platforms.slice(0, 8)) {
    const reach = p.totalFollowers > 0 ? `${(p.totalFollowers / 1000).toFixed(0)}K` : '-'
    lines.push(`| ${p.platform} | ${p.count} | ${reach} |`)
  }
  lines.push(``)

  // Top themes
  lines.push(`## Content Themes`)
  lines.push(``)
  lines.push(`| Theme | Coverage |`)
  lines.push(`|-------|----------|`)
  for (const t of snapshot.themes.slice(0, 8)) {
    const bar = '█'.repeat(Math.round(t.percentage / 5)) + '░'.repeat(20 - Math.round(t.percentage / 5))
    lines.push(`| ${t.theme} | ${bar} ${t.percentage}% |`)
  }
  lines.push(``)

  // Top influencers
  lines.push(`## Top Influencers by Reach`)
  lines.push(``)
  lines.push(`| Name | Platform | Followers | Relevance |`)
  lines.push(`|------|----------|-----------|-----------|`)
  for (const inf of snapshot.topInfluencers.slice(0, 10)) {
    const followers = `${(inf.followers / 1000).toFixed(0)}K`
    const relevance = inf.relevanceScore ? `${inf.relevanceScore}/10` : '-'
    lines.push(`| ${inf.name} | ${inf.platform} | ${followers} | ${relevance} |`)
  }
  lines.push(``)

  // Footer
  lines.push(`---`)
  lines.push(`*Report generated by Phantom Loom Social Intelligence*`)

  return lines.join('\n')
}

function generateSlackReport(snapshot: Snapshot, trends: TrendAnalysis | null): any {
  const blocks: any[] = []

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `📊 ${snapshot.brand.toUpperCase()} Social Intelligence Report`
    }
  })

  // Summary
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Influencers:* ${snapshot.totals.influencers}` },
      { type: 'mrkdwn', text: `*Total Reach:* ${snapshot.totals.totalFollowers.toLocaleString()}` },
      { type: 'mrkdwn', text: `*Organizations:* ${snapshot.totals.organizations}` },
      { type: 'mrkdwn', text: `*Avg Relevance:* ${snapshot.totals.avgRelevanceScore}/10` }
    ]
  })

  // Alerts
  if (trends && trends.alerts.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🚨 Alerts*\n' + trends.alerts.map(a => {
          const emoji = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🔵'
          return `${emoji} ${a.message}`
        }).join('\n')
      }
    })
  }

  // Top influencers
  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*👥 Top Influencers*\n' + snapshot.topInfluencers.slice(0, 5).map(inf =>
        `• ${inf.name} - ${(inf.followers / 1000).toFixed(0)}K (${inf.platform})`
      ).join('\n')
    }
  })

  // Top themes
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*📝 Top Themes*\n' + snapshot.themes.slice(0, 5).map(t =>
        `• ${t.theme}: ${t.percentage}%`
      ).join('\n')
    }
  })

  return { blocks }
}

async function postToSlack(report: any): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL || '#social-intelligence'

  if (!token) {
    console.log('SLACK_BOT_TOKEN not set, skipping Slack post')
    return false
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...report
      })
    })

    const result = await response.json() as { ok: boolean; error?: string }
    if (result.ok) {
      console.log(`Posted to Slack: ${channel}`)
      return true
    } else {
      console.error('Slack error:', result.error)
      return false
    }
  } catch (error: any) {
    console.error('Slack post failed:', error.message)
    return false
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args.find(a => !a.startsWith('--')) || 'givecare'
  const postSlack = args.includes('--slack')

  const snapshot = loadLatestSnapshot(brand)
  if (!snapshot) {
    console.log(`No snapshot found for ${brand}`)
    console.log('Run: npx tsx track-snapshot.ts first')
    process.exit(1)
  }

  const trends = loadTrends(brand)

  // Generate markdown report
  const markdown = generateMarkdownReport(snapshot, trends)
  const reportPath = join(__dirname, 'data', `${brand}-report.md`)
  writeFileSync(reportPath, markdown)
  console.log(`Report saved: ${reportPath}`)

  // Print to console
  console.log('\n' + markdown)

  // Post to Slack if requested
  if (postSlack) {
    const slackReport = generateSlackReport(snapshot, trends)
    await postToSlack(slackReport)
  }
}

main().catch(console.error)
