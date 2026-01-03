#!/usr/bin/env npx tsx
/**
 * Intelligence Pipeline - Unified runner for social intelligence
 *
 * Flow: enrich → detect-outliers → extract-hooks
 *
 * Usage:
 *   npx tsx pipeline.ts givecare [--skip-enrich] [--skip-extract]
 */

import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env from project root
config({ path: join(__dirname, '..', '..', '..', '.env') })

export interface PipelineOptions {
  brand: string
  skipEnrich?: boolean
  skipDetect?: boolean
  skipExtract?: boolean
  includePosts?: boolean
  minMultiplier?: number
  maxAgeDays?: number
  dryRun?: boolean
}

export interface PipelineResult {
  enriched: number
  outliers: number
  hooks: number
  errors: string[]
}

/**
 * Run the full intelligence pipeline
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    brand,
    skipEnrich = false,
    skipDetect = false,
    skipExtract = false,
    includePosts = true,
    minMultiplier = 50,
    maxAgeDays = 7,
    dryRun = false
  } = options

  const result: PipelineResult = {
    enriched: 0,
    outliers: 0,
    hooks: 0,
    errors: []
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`INTELLIGENCE PIPELINE: ${brand.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  // Check for required API tokens
  const hasApify = !!process.env.APIFY_API_TOKEN
  const hasGemini = !!process.env.GEMINI_API_KEY

  if (!hasApify && !skipEnrich) {
    console.log('\n⚠️  APIFY_API_TOKEN not set - skipping enrichment')
    options.skipEnrich = true
  }

  if (!hasGemini && !skipExtract) {
    console.log('\n⚠️  GEMINI_API_KEY not set - skipping hook extraction')
    options.skipExtract = true
  }

  // Step 1: Enrich influencer database with live metrics
  if (!options.skipEnrich && !dryRun) {
    console.log('\n--- STEP 1: Enriching influencer database ---')

    try {
      const { ApifyClient } = await import('apify-client')
      const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

      // Load influencer database
      const dbPath = join(__dirname, 'data', `${brand}-influencers.json`)
      if (!existsSync(dbPath)) {
        console.log(`  No influencer database found at ${dbPath}`)
        result.errors.push('No influencer database found')
      } else {
        const { readFileSync, writeFileSync } = await import('fs')
        const db = JSON.parse(readFileSync(dbPath, 'utf-8'))
        const allInfluencers = [...(db.influencers || []), ...(db.organizations || [])]

        // Collect Instagram usernames
        const igUsernames: string[] = []
        for (const inf of allInfluencers) {
          for (const handle of inf.handles || []) {
            if (handle.platform === 'instagram') {
              igUsernames.push(handle.username)
            }
          }
        }

        if (igUsernames.length > 0) {
          console.log(`  Enriching ${igUsernames.length} Instagram profiles...`)

          const run = await client.actor('apify/instagram-profile-scraper').call({
            usernames: igUsernames,
            resultsLimit: igUsernames.length,
            addParentData: true,
            ...(includePosts && {
              resultsType: 'details',
              postsCount: 20
            })
          })

          const { items } = await client.dataset(run.defaultDatasetId).listItems()
          console.log(`  Retrieved ${items.length} profiles`)

          // Update database with enriched data
          let updated = 0
          for (const item of items) {
            const data = item as any
            const username = data.username?.toLowerCase() || data.ownerUsername?.toLowerCase()
            if (!username) continue

            // Find and update the handle
            for (const inf of allInfluencers) {
              for (const handle of inf.handles || []) {
                if (handle.platform === 'instagram' && handle.username.toLowerCase() === username) {
                  handle.followers = data.followersCount
                  handle.verified = data.verified

                  if (includePosts && data.latestPosts) {
                    handle.recentPosts = data.latestPosts.map((p: any) => ({
                      id: p.id,
                      url: p.url,
                      caption: p.caption || '',
                      likes: p.likesCount || 0,
                      comments: p.commentsCount || 0,
                      views: p.videoViewCount || p.likesCount * 10,
                      postedAt: p.timestamp,
                      mediaType: p.type
                    }))

                    // Calculate median views
                    const views = handle.recentPosts.map((p: any) => p.views || p.likes * 10)
                    if (views.length > 0) {
                      views.sort((a: number, b: number) => a - b)
                      const mid = Math.floor(views.length / 2)
                      handle.medianViews = views.length % 2 !== 0
                        ? views[mid]
                        : (views[mid - 1] + views[mid]) / 2
                    }
                  }

                  updated++
                  break
                }
              }
            }
          }

          db.lastUpdated = new Date().toISOString()
          writeFileSync(dbPath, JSON.stringify(db, null, 2))
          console.log(`  ✓ Updated ${updated} influencers`)
          result.enriched = updated
        }
      }
    } catch (error: any) {
      console.error(`  ✗ Enrichment failed: ${error.message}`)
      result.errors.push(`Enrichment: ${error.message}`)
    }
  } else if (options.skipEnrich) {
    console.log('\n--- STEP 1: Skipping enrichment (--skip-enrich) ---')
  }

  // Step 2: Detect outliers (viral content)
  if (!skipDetect) {
    console.log('\n--- STEP 2: Detecting outliers ---')

    try {
      const { loadOutlierDb, saveOutlierDb, detectOutlierTier } = await import('./detect-outliers')

      const influencerDbPath = join(__dirname, 'data', `${brand}-influencers.json`)
      if (!existsSync(influencerDbPath)) {
        console.log('  No influencer database found')
        result.errors.push('No influencer database for outlier detection')
      } else {
        const { readFileSync } = await import('fs')
        const influencerDb = JSON.parse(readFileSync(influencerDbPath, 'utf-8'))
        const allInfluencers = [...(influencerDb.influencers || []), ...(influencerDb.organizations || [])]

        const db = loadOutlierDb(brand)
        const ageCutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
        let newOutliers = 0

        for (const influencer of allInfluencers) {
          for (const handle of influencer.handles || []) {
            const posts = handle.recentPosts
            const medianViews = handle.medianViews

            if (!posts || !medianViews || posts.length === 0) continue

            for (const post of posts) {
              const postDate = new Date(post.postedAt || 0).getTime()
              if (postDate < ageCutoff) continue

              const views = post.views || post.likes * 10
              const tier = detectOutlierTier(views, medianViews)

              if (tier && tier >= minMultiplier) {
                // Check for duplicate
                if (db.outliers.some(o => o.post.url === post.url)) continue

                db.outliers.push({
                  post: {
                    id: post.id || `${handle.username}-${Date.now()}`,
                    url: post.url || `https://instagram.com/p/${post.id}`,
                    platform: handle.platform,
                    authorUsername: handle.username,
                    authorFollowers: handle.followers || 0,
                    views,
                    likes: post.likes || 0,
                    comments: post.comments || 0,
                    caption: post.caption || '',
                    postedAt: post.postedAt || new Date().toISOString(),
                    scrapedAt: new Date().toISOString()
                  },
                  multiplier: tier,
                  medianAccountViews: medianViews,
                  capturedAt: new Date().toISOString(),
                  analyzed: false
                })

                newOutliers++
                console.log(`  [${tier}x] @${handle.username}: ${views.toLocaleString()} views`)
              }
            }
          }
        }

        saveOutlierDb(db)
        console.log(`  ✓ Found ${newOutliers} new outliers (${db.outliers.length} total)`)
        result.outliers = newOutliers
      }
    } catch (error: any) {
      console.error(`  ✗ Outlier detection failed: ${error.message}`)
      result.errors.push(`Outlier detection: ${error.message}`)
    }
  }

  // Step 3: Extract hooks from outliers
  if (!skipExtract && !dryRun) {
    console.log('\n--- STEP 3: Extracting hooks ---')

    try {
      const { loadOutlierDb, markOutlierAnalyzed } = await import('./detect-outliers')
      const { loadHookBank, saveHookBank, addHook } = await import('./hook-bank')
      const { GoogleGenAI } = await import('@google/genai')

      const outlierDb = loadOutlierDb(brand)
      const unanalyzed = outlierDb.outliers
        .filter(o => !o.analyzed && o.multiplier >= minMultiplier)
        .sort((a, b) => b.multiplier - a.multiplier)
        .slice(0, 10)

      if (unanalyzed.length === 0) {
        console.log('  No unanalyzed outliers found')
      } else {
        console.log(`  Analyzing ${unanalyzed.length} outliers...`)

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
        let extracted = 0

        for (const outlier of unanalyzed) {
          const caption = outlier.post.caption
          if (!caption || caption.length < 20) {
            markOutlierAnalyzed(brand, outlier.post.url)
            continue
          }

          const prompt = `Analyze this viral social media post and extract the hook pattern.

POST (${outlier.multiplier}x viral):
"${caption.slice(0, 500)}"

Extract:
1. The opening hook (first 1-2 sentences that grab attention)
2. An amplified version of that hook (more dramatic/emotional)
3. Category: curiosity, controversy, transformation, secret, listicle, story, question, or statistic
4. 3-5 theme keywords this hook works for

Respond in JSON:
{
  "original": "the exact opening hook from the post",
  "amplified": "a more dramatic version",
  "category": "one of the categories above",
  "themes": ["theme1", "theme2", "theme3"]
}`

          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
            })

            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const jsonMatch = text.match(/\{[\s\S]*\}/)

            if (jsonMatch) {
              const hookData = JSON.parse(jsonMatch[0])
              addHook(brand, {
                original: hookData.original,
                amplified: hookData.amplified,
                category: hookData.category,
                multiplier: outlier.multiplier,
                platform: outlier.post.platform,
                sourceUrl: outlier.post.url,
                themes: hookData.themes || []
              })
              extracted++
              console.log(`  [${outlier.multiplier}x] Extracted: "${hookData.original?.slice(0, 50)}..."`)
            }

            markOutlierAnalyzed(brand, outlier.post.url)
          } catch (error: any) {
            console.error(`  Failed to analyze: ${error.message}`)
          }
        }

        console.log(`  ✓ Extracted ${extracted} hooks`)
        result.hooks = extracted
      }
    } catch (error: any) {
      console.error(`  ✗ Hook extraction failed: ${error.message}`)
      result.errors.push(`Hook extraction: ${error.message}`)
    }
  } else if (skipExtract) {
    console.log('\n--- STEP 3: Skipping hook extraction (--skip-extract) ---')
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('PIPELINE COMPLETE')
  console.log(`${'='.repeat(60)}`)
  console.log(`  Enriched: ${result.enriched} influencers`)
  console.log(`  Outliers: ${result.outliers} new`)
  console.log(`  Hooks: ${result.hooks} extracted`)
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`)
    for (const err of result.errors) {
      console.log(`    - ${err}`)
    }
  }

  return result
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args.find(a => !a.startsWith('--')) || 'givecare'

  await runPipeline({
    brand,
    skipEnrich: args.includes('--skip-enrich'),
    skipDetect: args.includes('--skip-detect'),
    skipExtract: args.includes('--skip-extract'),
    includePosts: !args.includes('--no-posts'),
    minMultiplier: 50,
    maxAgeDays: 7,
    dryRun: args.includes('--dry-run')
  })
}

main().catch(console.error)
