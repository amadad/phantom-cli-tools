#!/usr/bin/env npx tsx
/**
 * View the influencer landscape database
 * Usage: npx tsx view-landscape.ts [brand] [--platform=instagram]
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Influencer {
  id: string
  name: string
  type: string
  description: string
  handles: { platform: string; username: string; url: string; followers?: number }[]
  content?: { themes: string[]; aesthetic?: string }
  strategy?: { relevanceScore?: number; partnershipPotential?: string; notes?: string }
}

interface Database {
  brand: string
  lastUpdated: string
  influencers: Influencer[]
  organizations?: Influencer[]
  insights?: {
    topThemes: { theme: string; count: number }[]
    platformBreakdown: { platform: string; count: number }[]
    gaps: string[]
    keyPartnershipOpportunities: string[]
  }
}

function loadDatabase(brand: string): Database | null {
  const path = join(__dirname, 'data', `${brand}-influencers.json`)
  if (!existsSync(path)) {
    console.error(`Database not found for brand: ${brand}`)
    return null
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function viewByPlatform(db: Database, platform?: string) {
  const all = [...db.influencers, ...(db.organizations || [])]

  const grouped = new Map<string, Influencer[]>()
  for (const inf of all) {
    for (const handle of inf.handles) {
      if (!platform || handle.platform === platform) {
        const list = grouped.get(handle.platform) || []
        list.push(inf)
        grouped.set(handle.platform, list)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`INFLUENCER LANDSCAPE: ${db.brand.toUpperCase()}`)
  console.log(`Last Updated: ${db.lastUpdated}`)
  console.log(`${'='.repeat(60)}\n`)

  for (const [plat, influencers] of grouped.entries()) {
    console.log(`\n## ${plat.toUpperCase()} (${influencers.length})`)
    console.log('-'.repeat(40))

    for (const inf of influencers) {
      const handle = inf.handles.find(h => h.platform === plat)!
      const followers = handle.followers ? ` (${(handle.followers / 1000).toFixed(0)}K)` : ''
      const score = inf.strategy?.relevanceScore ? ` [${inf.strategy.relevanceScore}/10]` : ''

      console.log(`\n### ${inf.name}${followers}${score}`)
      console.log(`    @${handle.username}`)
      console.log(`    ${inf.description}`)

      if (inf.content?.themes) {
        console.log(`    Themes: ${inf.content.themes.join(', ')}`)
      }
      if (inf.strategy?.partnershipPotential) {
        console.log(`    Partnership: ${inf.strategy.partnershipPotential}`)
      }
      if (inf.strategy?.notes) {
        console.log(`    Notes: ${inf.strategy.notes}`)
      }
    }
  }
}

function viewInsights(db: Database) {
  if (!db.insights) return

  console.log(`\n${'='.repeat(60)}`)
  console.log(`INSIGHTS`)
  console.log(`${'='.repeat(60)}\n`)

  console.log('## Top Content Themes')
  for (const t of db.insights.topThemes) {
    console.log(`  - ${t.theme}: ${t.count} influencers`)
  }

  console.log('\n## Platform Breakdown')
  for (const p of db.insights.platformBreakdown) {
    console.log(`  - ${p.platform}: ${p.count}`)
  }

  console.log('\n## Identified Gaps')
  for (const gap of db.insights.gaps) {
    console.log(`  - ${gap}`)
  }

  console.log('\n## Key Partnership Opportunities')
  for (const opp of db.insights.keyPartnershipOpportunities) {
    console.log(`  - ${opp}`)
  }
}

// CLI
const args = process.argv.slice(2)
const brand = args[0] || 'givecare'
const platformArg = args.find(a => a.startsWith('--platform='))
const platform = platformArg?.split('=')[1]

const db = loadDatabase(brand)
if (db) {
  viewByPlatform(db, platform)
  viewInsights(db)
}
