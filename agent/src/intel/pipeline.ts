/**
 * Intelligence Pipeline - Unified runner for social intelligence
 *
 * Flow: enrich → detect-outliers → extract-hooks
 *
 * Usage:
 *   npx tsx pipeline.ts <brand> [--skip-enrich] [--skip-extract]
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { config } from 'dotenv'
import { getIntelPath } from './paths'
import { getProjectRoot, join, getDefaultBrand } from '../core/paths'
import {
  loadOutlierDb,
  saveOutlierDb,
  addOutlier,
  getOutliersByPriority,
  markOutlierAnalyzed,
  type ContentPost
} from './detect-outliers'
import { addHook } from './hook-bank'
import { extractJson } from '../core/json'
import { calculateMedianViews, getLikesMultiplier } from '../core/stats'

// Load env from project root
config({ path: join(getProjectRoot(), '.env') })

export interface PipelineOptions {
  brand: string
  skipEnrich?: boolean
  skipDetect?: boolean
  skipExtract?: boolean
  includePosts?: boolean
  minMultiplier?: number
  maxAgeDays?: number
  dryRun?: boolean
  failFast?: boolean
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
    dryRun = false,
    failFast = false
  } = options

  const result: PipelineResult = { enriched: 0, outliers: 0, hooks: 0, errors: [] }

  function handleError(step: string, error: Error) {
    const message = `${step}: ${error.message}`
    if (failFast) throw new Error(message)
    result.errors.push(message)
    console.error(`  ✗ ${step} failed: ${error.message}`)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`INTELLIGENCE PIPELINE: ${brand.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  const hasApify = !!process.env.APIFY_API_TOKEN
  const hasGemini = !!process.env.GEMINI_API_KEY

  if (!hasApify && !skipEnrich) {
    console.log('\n⚠️  APIFY_API_TOKEN not set - skipping enrichment')
  }
  if (!hasGemini && !skipExtract) {
    console.log('\n⚠️  GEMINI_API_KEY not set - skipping hook extraction')
  }

  // === STEP 1: Enrich influencer database ===
  if (!skipEnrich && hasApify && !dryRun) {
    console.log('\n--- STEP 1: Enriching influencer database ---')
    try {
      result.enriched = await enrichInfluencers(brand, includePosts)
    } catch (error: any) {
      handleError('Enrichment', error)
    }
  } else {
    console.log('\n--- STEP 1: Skipping enrichment ---')
  }

  // === STEP 2: Detect outliers ===
  if (!skipDetect) {
    console.log('\n--- STEP 2: Detecting outliers ---')
    try {
      result.outliers = await detectOutliers(brand, minMultiplier, maxAgeDays)
    } catch (error: any) {
      handleError('Outlier detection', error)
    }
  }

  // === STEP 3: Extract hooks ===
  if (!skipExtract && hasGemini && !dryRun) {
    console.log('\n--- STEP 3: Extracting hooks ---')
    try {
      result.hooks = await extractHooks(brand, minMultiplier)
    } catch (error: any) {
      handleError('Hook extraction', error)
    }
  } else if (skipExtract) {
    console.log('\n--- STEP 3: Skipping hook extraction ---')
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
    result.errors.forEach(err => console.log(`    - ${err}`))
  }

  return result
}

/**
 * Step 1: Enrich influencer database via Apify
 * Supports Instagram and Twitter platforms
 */
async function enrichInfluencers(brand: string, includePosts: boolean): Promise<number> {
  const dbPath = getIntelPath(brand, 'influencers.json')
  if (!existsSync(dbPath)) {
    console.log(`  No influencer database found at ${dbPath}`)
    return 0
  }

  const { ApifyClient } = await import('apify-client')
  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

  const db = JSON.parse(readFileSync(dbPath, 'utf-8'))
  const allInfluencers = [...(db.influencers || []), ...(db.organizations || [])]

  // Collect handles by platform
  const handlesByPlatform = new Map<string, string[]>()
  for (const inf of allInfluencers) {
    for (const handle of inf.handles || []) {
      const platform = handle.platform
      if (['instagram', 'twitter'].includes(platform)) {
        const usernames = handlesByPlatform.get(platform) || []
        usernames.push(handle.username.replace('@', ''))
        handlesByPlatform.set(platform, usernames)
      }
    }
  }

  if (handlesByPlatform.size === 0) {
    console.log('  No Instagram or Twitter handles to enrich')
    return 0
  }

  let updated = 0

  // Enrich Instagram
  const igUsernames = handlesByPlatform.get('instagram') || []
  if (igUsernames.length > 0) {
    console.log(`  Enriching ${igUsernames.length} Instagram profiles...`)
    try {
      const run = await client.actor('apify/instagram-profile-scraper').call({
        usernames: igUsernames,
        resultsLimit: igUsernames.length,
        addParentData: true,
        ...(includePosts && { resultsType: 'details', postsCount: 20 })
      })

      const { items } = await client.dataset(run.defaultDatasetId).listItems()
      updated += updateInfluencersFromResults(allInfluencers, items, 'instagram', includePosts)
    } catch (error: any) {
      console.error(`  ✗ Instagram enrichment failed: ${error.message}`)
    }
  }

  // Enrich Twitter
  const twUsernames = handlesByPlatform.get('twitter') || []
  if (twUsernames.length > 0) {
    console.log(`  Enriching ${twUsernames.length} Twitter profiles...`)
    try {
      const run = await client.actor('quacker/twitter-scraper').call({
        handles: twUsernames,
        tweetsDesired: includePosts ? 20 : 0,
        proxyConfig: { useApifyProxy: true }
      })

      const { items } = await client.dataset(run.defaultDatasetId).listItems()
      // Twitter scraper returns individual tweets, aggregate by username
      const tweetsByUser = aggregateTweetsByUser(items)
      updated += updateTwitterInfluencers(allInfluencers, tweetsByUser, includePosts)
    } catch (error: any) {
      console.error(`  ✗ Twitter enrichment failed: ${error.message}`)
    }
  }

  db.lastUpdated = new Date().toISOString()
  writeFileSync(dbPath, JSON.stringify(db, null, 2))
  console.log(`  ✓ Updated ${updated} influencers`)
  return updated
}

/**
 * Aggregate tweets by username from quacker/twitter-scraper output
 */
function aggregateTweetsByUser(items: any[]): Map<string, any[]> {
  const tweetsByUser = new Map<string, any[]>()

  for (const item of items) {
    const tweet = item as any
    // The scraper returns tweets with author info
    const username = (
      tweet.author?.userName ||
      tweet.user?.screen_name ||
      tweet.screen_name ||
      tweet.username ||
      ''
    ).toLowerCase()

    if (!username) continue

    const tweets = tweetsByUser.get(username) || []
    tweets.push(tweet)
    tweetsByUser.set(username, tweets)
  }

  return tweetsByUser
}

/**
 * Update Twitter influencers from aggregated tweets
 */
function updateTwitterInfluencers(
  allInfluencers: any[],
  tweetsByUser: Map<string, any[]>,
  includePosts: boolean
): number {
  let updated = 0

  for (const [username, tweets] of tweetsByUser.entries()) {
    if (tweets.length === 0) continue

    // Find matching influencer handle
    for (const inf of allInfluencers) {
      for (const handle of inf.handles || []) {
        if (handle.platform === 'twitter' && handle.username.toLowerCase().replace('@', '') === username) {
          // Get profile info from first tweet's author data
          const firstTweet = tweets[0]
          const author = firstTweet.author || firstTweet.user || {}
          handle.followers = author.followers || author.followers_count || handle.followers
          handle.verified = author.isBlueVerified || author.verified || handle.verified

          if (includePosts) {
            handle.recentPosts = tweets.slice(0, 20).map((t: any) => ({
              id: t.id || t.id_str,
              url: t.url || `https://twitter.com/${username}/status/${t.id || t.id_str}`,
              caption: t.text || t.full_text || '',
              likes: t.likeCount || t.favorite_count || 0,
              comments: t.replyCount || t.reply_count || 0,
              views: t.viewCount || t.views_count || (t.likeCount || 0) * 50,  // Twitter ~50x impressions/like
              shares: t.retweetCount || t.retweet_count || 0,
              postedAt: t.createdAt || t.created_at,
              mediaType: t.media?.length > 0 ? 'media' : 'text'
            }))

            // Calculate median views
            if (handle.recentPosts.length > 0) {
              handle.medianViews = calculateMedianViews(handle.recentPosts, getLikesMultiplier('twitter'))
            }
          }

          updated++
          console.log(`  Updated @${username}: ${(handle.followers || 0).toLocaleString()} followers, ${tweets.length} tweets`)
          break
        }
      }
    }
  }

  return updated
}

/**
 * Update influencer handles from Apify results
 */
function updateInfluencersFromResults(
  allInfluencers: any[],
  items: any[],
  platform: string,
  includePosts: boolean
): number {
  let updated = 0

  for (const item of items) {
    const data = item as any
    let username: string

    if (platform === 'instagram') {
      username = (data.username || data.ownerUsername || '').toLowerCase()
    } else if (platform === 'twitter') {
      username = (data.username || data.screen_name || data.handle || '').toLowerCase().replace('@', '')
    } else {
      continue
    }

    if (!username) continue

    for (const inf of allInfluencers) {
      for (const handle of inf.handles || []) {
        if (handle.platform === platform && handle.username.toLowerCase().replace('@', '') === username) {
          // Update followers
          if (platform === 'instagram') {
            handle.followers = data.followersCount
            handle.verified = data.verified
          } else if (platform === 'twitter') {
            handle.followers = data.followers_count || data.followersCount
            handle.verified = data.verified || data.is_blue_verified
          }

          // Update recent posts
          if (includePosts) {
            if (platform === 'instagram' && data.latestPosts) {
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
            } else if (platform === 'twitter' && data.tweets) {
              handle.recentPosts = data.tweets.map((t: any) => ({
                id: t.id_str || t.id,
                url: `https://twitter.com/${username}/status/${t.id_str || t.id}`,
                caption: t.full_text || t.text || '',
                likes: t.favorite_count || t.likes || 0,
                comments: t.reply_count || 0,
                views: t.views_count || t.impression_count || (t.favorite_count || 0) * 20,
                shares: t.retweet_count || 0,
                postedAt: t.created_at,
                mediaType: t.entities?.media ? 'media' : 'text'
              }))
            }

            // Calculate median views (platform-specific multiplier)
            if (handle.recentPosts && handle.recentPosts.length > 0) {
              handle.medianViews = calculateMedianViews(handle.recentPosts, getLikesMultiplier(platform))
            }
          }

          updated++
          console.log(`  Updated @${username}: ${(handle.followers || 0).toLocaleString()} followers`)
          break
        }
      }
    }
  }

  return updated
}

/**
 * Step 2: Detect outliers from influencer posts
 */
async function detectOutliers(brand: string, minMultiplier: number, maxAgeDays: number): Promise<number> {
  const dbPath = getIntelPath(brand, 'influencers.json')
  if (!existsSync(dbPath)) {
    console.log('  No influencer database found')
    return 0
  }

  const influencerDb = JSON.parse(readFileSync(dbPath, 'utf-8'))
  const allInfluencers = [...(influencerDb.influencers || []), ...(influencerDb.organizations || [])]
  const ageCutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

  let newOutliers = 0

  for (const influencer of allInfluencers) {
    for (const handle of influencer.handles || []) {
      const { recentPosts, medianViews, platform, username, followers } = handle
      if (!recentPosts || !medianViews) continue

      for (const post of recentPosts) {
        const postDate = new Date(post.postedAt || 0).getTime()
        if (postDate < ageCutoff) continue

        // Build ContentPost and use addOutlier from detect-outliers module
        const defaultUrl = platform === 'twitter'
          ? `https://twitter.com/${username}/status/${post.id}`
          : `https://instagram.com/p/${post.id}`
        const contentPost: ContentPost = {
          id: post.id || `${username}-${Date.now()}`,
          url: post.url || defaultUrl,
          platform,
          authorUsername: username,
          authorFollowers: followers || 0,
          views: post.views || post.likes * (platform === 'twitter' ? 50 : 10),
          likes: post.likes || 0,
          comments: post.comments || 0,
          caption: post.caption || '',
          postedAt: post.postedAt || new Date().toISOString(),
          scrapedAt: new Date().toISOString()
        }

        const outlier = addOutlier(brand, contentPost, medianViews)
        if (outlier && outlier.multiplier >= minMultiplier) {
          newOutliers++
          console.log(`  [${outlier.multiplier}x] @${username}: ${contentPost.views.toLocaleString()} views`)
        }
      }
    }
  }

  const db = loadOutlierDb(brand)
  console.log(`  ✓ Found ${newOutliers} new outliers (${db.outliers.length} total)`)
  return newOutliers
}

/**
 * Step 3: Extract hooks from unanalyzed outliers
 */
async function extractHooks(brand: string, minMultiplier: number): Promise<number> {
  const outliers = getOutliersByPriority(brand, {
    minMultiplier: minMultiplier as any,
    unanalyzedOnly: true,
    limit: 10
  })

  if (outliers.length === 0) {
    console.log('  No unanalyzed outliers found')
    return 0
  }

  console.log(`  Analyzing ${outliers.length} outliers...`)

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  let extracted = 0

  for (const outlier of outliers) {
    const caption = outlier.post.caption
    if (!caption || caption.length < 20) {
      markOutlierAnalyzed(brand, outlier.post.url)
      continue
    }

    const prompt = `Analyze this viral post (${outlier.multiplier}x viral) and extract the hook:
"${caption.slice(0, 500)}"

Return JSON:
{"original": "opening hook", "amplified": "dramatic version", "category": "curiosity|controversy|transformation|secret|listicle|story|question|statistic", "themes": ["theme1", "theme2"]}`

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      })

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const result = extractJson<any>(text, 'hook')

      if (result.success) {
        addHook(brand, {
          original: result.data.original,
          amplified: result.data.amplified,
          category: result.data.category,
          multiplier: outlier.multiplier,
          platform: outlier.post.platform,
          sourceUrl: outlier.post.url,
          themes: result.data.themes || []
        })
        extracted++
        console.log(`  [${outlier.multiplier}x] Extracted: "${result.data.original?.slice(0, 50)}..."`)
      }

      markOutlierAnalyzed(brand, outlier.post.url)
    } catch (error: any) {
      console.error(`  Failed to analyze: ${error.message}`)
    }
  }

  console.log(`  ✓ Extracted ${extracted} hooks`)
  return extracted
}
