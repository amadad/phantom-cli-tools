#!/usr/bin/env npx tsx
/**
 * Discover influencers using Exa semantic search
 * Usage: npx tsx discover-exa.ts [concept] [--limit=30]
 *
 * Requires: EXA_API_KEY environment variable
 */

import Exa from 'exa-js'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env from project root
config({ path: join(__dirname, '..', '..', '..', '.env') })

interface DiscoveryResult {
  title: string
  url: string
  snippet: string
  platform: string
  relevanceScore: number
}

interface DiscoveryRun {
  concept: string
  timestamp: string
  queries: string[]
  results: DiscoveryResult[]
}

function detectPlatform(url: string): string {
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com')) return 'youtube'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  if (url.includes('substack.com')) return 'substack'
  if (url.includes('podcasts.apple.com') || url.includes('spotify.com')) return 'podcast'
  return 'website'
}

async function discoverWithExa(concept: string, limit: number = 30): Promise<DiscoveryRun> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    throw new Error('EXA_API_KEY not set in environment')
  }

  const exa = new Exa(apiKey)
  const allResults: DiscoveryResult[] = []

  // Discovery queries - semantic search finds related content
  const queries = [
    // Find influencers directly
    `${concept} influencer instagram profile`,
    `${concept} content creator social media`,
    `top ${concept} voices to follow`,
    `${concept} thought leader expert`,

    // Find by platform
    `${concept} youtuber channel`,
    `${concept} tiktok creator`,
    `${concept} podcast host`,
    `${concept} newsletter substack`,

    // Find lists and roundups (these often have many influencers)
    `best ${concept} accounts to follow 2024`,
    `${concept} influencers you should know`,
    `top ${concept} instagram accounts`,

    // Find communities and organizations (they know the influencers)
    `${concept} community organization`,
    `${concept} advocacy group`,
    `${concept} support network online`,
  ]

  console.log(`\nDiscovering: "${concept}"`)
  console.log(`Running ${queries.length} queries...\n`)

  for (const query of queries) {
    try {
      console.log(`  Searching: ${query.substring(0, 50)}...`)

      const response = await exa.search(query, {
        type: 'neural',
        useAutoprompt: true,
        numResults: Math.ceil(limit / queries.length) + 5,
        contents: {
          text: { maxCharacters: 500 }
        }
      })

      for (const result of response.results) {
        allResults.push({
          title: result.title || '',
          url: result.url,
          snippet: (result as any).text || '',
          platform: detectPlatform(result.url),
          relevanceScore: (result as any).score || 0.5
        })
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200))

    } catch (error: any) {
      console.error(`  Error on query "${query}": ${error.message}`)
    }
  }

  // Dedupe by URL
  const seen = new Set<string>()
  const dedupedResults = allResults.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // Sort by relevance
  dedupedResults.sort((a, b) => b.relevanceScore - a.relevanceScore)

  return {
    concept,
    timestamp: new Date().toISOString(),
    queries,
    results: dedupedResults.slice(0, limit * 2) // Keep extra for manual filtering
  }
}

async function findSimilar(seedUrl: string, limit: number = 20): Promise<DiscoveryResult[]> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) throw new Error('EXA_API_KEY not set')

  const exa = new Exa(apiKey)

  console.log(`\nFinding similar to: ${seedUrl}`)

  const response = await exa.findSimilar(seedUrl, {
    numResults: limit,
    contents: {
      text: { maxCharacters: 300 }
    }
  })

  return response.results.map(r => ({
    title: r.title || '',
    url: r.url,
    snippet: (r as any).text || '',
    platform: detectPlatform(r.url),
    relevanceScore: (r as any).score || 0.5
  }))
}

function printResults(run: DiscoveryRun) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`DISCOVERY RESULTS: ${run.concept.toUpperCase()}`)
  console.log(`Found: ${run.results.length} unique results`)
  console.log(`${'='.repeat(60)}\n`)

  // Group by platform
  const byPlatform = new Map<string, DiscoveryResult[]>()
  for (const r of run.results) {
    const list = byPlatform.get(r.platform) || []
    list.push(r)
    byPlatform.set(r.platform, list)
  }

  for (const [platform, results] of byPlatform.entries()) {
    console.log(`\n## ${platform.toUpperCase()} (${results.length})`)
    console.log('-'.repeat(40))

    for (const r of results.slice(0, 10)) {
      console.log(`\n${r.title}`)
      console.log(`  ${r.url}`)
      if (r.snippet) {
        console.log(`  ${r.snippet.substring(0, 150)}...`)
      }
    }
  }
}

function saveResults(run: DiscoveryRun, outputPath: string) {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(outputPath, JSON.stringify(run, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const concept = args[0] || 'caregiving'
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 30
  const similarArg = args.find(a => a.startsWith('--similar='))

  if (similarArg) {
    // Find similar to a seed URL
    const seedUrl = similarArg.split('=')[1]
    const results = await findSimilar(seedUrl, limit)
    console.log(JSON.stringify(results, null, 2))
  } else {
    // Full discovery run
    const run = await discoverWithExa(concept, limit)
    printResults(run)

    // Save raw results
    const outputPath = join(__dirname, 'data', `discovery-${concept}-${Date.now()}.json`)
    saveResults(run, outputPath)
  }
}

main().catch(console.error)
