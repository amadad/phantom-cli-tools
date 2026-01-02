#!/usr/bin/env npx tsx
/**
 * Run brand-specific discovery searches
 * Usage: npx tsx discover-brand.ts [brand] [--cadence=weekly|monthly|all]
 *
 * Reads search strategy from brand's influencer database and runs Exa searches.
 * Requires: EXA_API_KEY environment variable
 */

import Exa from 'exa-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '..', '..', '.env') })

interface SearchStrategy {
  weekly?: string[]
  monthly?: string[]
}

interface Database {
  brand: string
  searchStrategy?: SearchStrategy
}

interface DiscoveryResult {
  query: string
  results: {
    title: string
    url: string
    snippet: string
    platform: string
  }[]
}

function detectPlatform(url: string): string {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com')) return 'youtube'
  if (url.includes('substack.com')) return 'substack'
  if (url.includes('github.com')) return 'github'
  if (url.includes('medium.com')) return 'medium'
  return 'website'
}

function loadDatabase(brand: string): Database | null {
  const path = join(__dirname, 'data', `${brand}-influencers.json`)
  if (!existsSync(path)) {
    console.error(`Database not found for brand: ${brand}`)
    return null
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

async function runSearches(queries: string[], exa: Exa): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = []

  for (const query of queries) {
    console.log(`\nSearching: "${query}"`)

    try {
      const response = await exa.search(query, {
        type: 'neural',
        useAutoprompt: true,
        numResults: 10,
        contents: {
          text: { maxCharacters: 300 }
        }
      })

      const queryResults = response.results.map(r => ({
        title: r.title || '',
        url: r.url,
        snippet: (r as any).text || '',
        platform: detectPlatform(r.url)
      }))

      results.push({
        query,
        results: queryResults
      })

      console.log(`  Found ${queryResults.length} results`)

      // Rate limit
      await new Promise(r => setTimeout(r, 300))

    } catch (error: any) {
      console.error(`  Error: ${error.message}`)
      results.push({ query, results: [] })
    }
  }

  return results
}

function printResults(results: DiscoveryResult[]) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`DISCOVERY RESULTS`)
  console.log(`${'='.repeat(60)}`)

  for (const { query, results: queryResults } of results) {
    console.log(`\n## "${query}" (${queryResults.length})`)
    console.log('-'.repeat(40))

    // Group by platform
    const byPlatform = new Map<string, typeof queryResults>()
    for (const r of queryResults) {
      const list = byPlatform.get(r.platform) || []
      list.push(r)
      byPlatform.set(r.platform, list)
    }

    for (const [platform, platformResults] of byPlatform.entries()) {
      console.log(`\n### ${platform.toUpperCase()}`)
      for (const r of platformResults.slice(0, 3)) {
        console.log(`  ${r.title}`)
        console.log(`    ${r.url}`)
      }
    }
  }
}

function saveResults(brand: string, cadence: string, results: DiscoveryResult[]) {
  const outputDir = join(__dirname, 'data', 'discoveries')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `${brand}-${cadence}-${timestamp}.json`
  const filepath = join(outputDir, filename)

  writeFileSync(filepath, JSON.stringify({
    brand,
    cadence,
    timestamp: new Date().toISOString(),
    results
  }, null, 2))

  console.log(`\nResults saved: ${filepath}`)
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args.find(a => !a.startsWith('--')) || 'scty'
  const cadenceArg = args.find(a => a.startsWith('--cadence='))
  const cadence = cadenceArg?.split('=')[1] || 'weekly'

  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    console.error('EXA_API_KEY not set in environment')
    process.exit(1)
  }

  const db = loadDatabase(brand)
  if (!db) process.exit(1)

  if (!db.searchStrategy) {
    console.error(`No search strategy defined for ${brand}`)
    console.log('Add a "searchStrategy" object to the influencer database')
    process.exit(1)
  }

  // Get queries based on cadence
  let queries: string[] = []
  if (cadence === 'weekly') {
    queries = db.searchStrategy.weekly || []
  } else if (cadence === 'monthly') {
    queries = db.searchStrategy.monthly || []
  } else if (cadence === 'all') {
    queries = [
      ...(db.searchStrategy.weekly || []),
      ...(db.searchStrategy.monthly || [])
    ]
  }

  if (queries.length === 0) {
    console.error(`No ${cadence} searches defined for ${brand}`)
    process.exit(1)
  }

  console.log(`${'='.repeat(60)}`)
  console.log(`BRAND DISCOVERY: ${brand.toUpperCase()}`)
  console.log(`Cadence: ${cadence}`)
  console.log(`Queries: ${queries.length}`)
  console.log(`${'='.repeat(60)}`)

  const exa = new Exa(apiKey)
  const results = await runSearches(queries, exa)

  printResults(results)
  saveResults(brand, cadence, results)
}

main().catch(console.error)
