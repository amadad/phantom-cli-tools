#!/usr/bin/env npx tsx
/**
 * Enrich influencer database with live metrics from Apify
 * Usage: npx tsx enrich-apify.ts [brand] [--platform=instagram] [--dry-run]
 *
 * Requires: APIFY_API_TOKEN environment variable
 *
 * Apify Actors used:
 * - Instagram: apify/instagram-profile-scraper
 * - TikTok: clockworks/tiktok-scraper
 * - YouTube: bernardo/youtube-channel-scraper
 */

import { ApifyClient } from 'apify-client'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { config } from 'dotenv'
import { getIntelPath, ensureIntelDir } from './paths'
import { getProjectRoot, join, getDefaultBrand } from '../core/paths'

// Load env from project root
config({ path: join(getProjectRoot(), '.env') })

interface RecentPost {
  id: string
  url: string
  caption: string
  likes: number
  comments: number
  views?: number
  shares?: number
  postedAt: string
  mediaType: string
}

interface SocialHandle {
  platform: string
  username: string
  url: string
  followers?: number
  verified?: boolean
  recentPosts?: RecentPost[]
  medianViews?: number
}

interface Influencer {
  id: string
  name: string
  type: string
  description: string
  handles: SocialHandle[]
  metrics?: {
    totalFollowers?: number
    engagementRate?: number
    avgLikes?: number
    avgComments?: number
    postingFrequency?: string
    lastUpdated?: string
    medianViews?: number  // For outlier detection
  }
  content?: {
    themes: string[]
    aesthetic?: string
  }
  strategy?: {
    relevanceScore?: number
    partnershipPotential?: string
    notes?: string
  }
  recentPosts?: RecentPost[]  // Post-level data for outlier detection
}

interface Database {
  brand: string
  lastUpdated: string
  influencers: Influencer[]
  organizations?: Influencer[]
  insights?: any
}

// Apify actor IDs for each platform
const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  youtube: 'bernardo/youtube-channel-scraper',
  twitter: 'quacker/twitter-scraper'
}

async function enrichInstagram(
  client: ApifyClient,
  usernames: string[],
  dryRun: boolean,
  includePosts: boolean = false
): Promise<Map<string, any>> {
  console.log(`\nEnriching ${usernames.length} Instagram profiles${includePosts ? ' (with posts)' : ''}...`)

  if (dryRun) {
    console.log('  [DRY RUN] Would scrape:', usernames.join(', '))
    return new Map()
  }

  const results = new Map<string, any>()

  try {
    // Use profile scraper with posts included (not posts-only mode)
    const run = await client.actor(ACTORS.instagram).call({
      usernames,
      resultsLimit: usernames.length,
      // Request posts to be included with profile data
      addParentData: true,
      ...(includePosts && {
        resultsType: 'details',  // Full profile with posts
        postsCount: 20           // Number of recent posts to fetch
      })
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    for (const item of items) {
      const data = item as any
      const username = data.username?.toLowerCase() || data.ownerUsername?.toLowerCase()

      if (!username) continue

      // Build profile data
      const profileData: any = {
        followers: data.followersCount,
        following: data.followsCount,
        posts: data.postsCount,
        verified: data.verified,
        bio: data.biography,
        engagement: data.avgEngagement,
        profilePic: data.profilePicUrl
      }

      // Include recent posts if scraped
      if (includePosts && data.latestPosts) {
        profileData.recentPosts = data.latestPosts.map((p: any) => ({
          id: p.id,
          url: p.url,
          caption: p.caption || '',
          likes: p.likesCount || 0,
          comments: p.commentsCount || 0,
          views: p.videoViewCount || p.likesCount * 10, // Estimate if not available
          postedAt: p.timestamp,
          mediaType: p.type
        }))

        // Calculate median views for outlier detection
        const views = profileData.recentPosts.map((p: any) => p.views || p.likes * 10)
        if (views.length > 0) {
          views.sort((a: number, b: number) => a - b)
          const mid = Math.floor(views.length / 2)
          profileData.medianViews = views.length % 2 !== 0
            ? views[mid]
            : (views[mid - 1] + views[mid]) / 2
        }
      }

      results.set(username, profileData)
    }

    console.log(`  ✓ Retrieved ${results.size} Instagram profiles`)
  } catch (error: any) {
    console.error(`  ✗ Instagram enrichment failed: ${error.message}`)
  }

  return results
}

async function enrichTikTok(
  client: ApifyClient,
  usernames: string[],
  dryRun: boolean
): Promise<Map<string, any>> {
  console.log(`\nEnriching ${usernames.length} TikTok profiles...`)

  if (dryRun) {
    console.log('  [DRY RUN] Would scrape:', usernames.join(', '))
    return new Map()
  }

  const results = new Map<string, any>()

  try {
    const profiles = usernames.map(u => `https://www.tiktok.com/@${u}`)

    const run = await client.actor(ACTORS.tiktok).call({
      profiles,
      resultsPerPage: 1,
      shouldDownloadVideos: false
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    for (const item of items) {
      const data = item as any
      if (data.authorMeta) {
        results.set(data.authorMeta.name?.toLowerCase(), {
          followers: data.authorMeta.fans,
          following: data.authorMeta.following,
          likes: data.authorMeta.heart,
          videos: data.authorMeta.video,
          verified: data.authorMeta.verified
        })
      }
    }

    console.log(`  ✓ Retrieved ${results.size} TikTok profiles`)
  } catch (error: any) {
    console.error(`  ✗ TikTok enrichment failed: ${error.message}`)
  }

  return results
}

async function enrichTwitter(
  client: ApifyClient,
  usernames: string[],
  dryRun: boolean,
  includePosts: boolean = false
): Promise<Map<string, any>> {
  console.log(`\nEnriching ${usernames.length} Twitter/X profiles${includePosts ? ' (with posts)' : ''}...`)

  if (dryRun) {
    console.log('  [DRY RUN] Would scrape:', usernames.join(', '))
    return new Map()
  }

  const results = new Map<string, any>()

  try {
    // Use quacker/twitter-scraper for profile + tweets
    const run = await client.actor(ACTORS.twitter).call({
      handles: usernames,
      tweetsDesired: includePosts ? 20 : 0,
      proxyConfig: { useApifyProxy: true }
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    for (const item of items) {
      const data = item as any
      const username = (data.username || data.screen_name || data.handle)?.toLowerCase()?.replace('@', '')

      if (!username) continue

      const profileData: any = {
        followers: data.followers_count || data.followersCount,
        following: data.friends_count || data.followingCount,
        tweets: data.statuses_count || data.tweetsCount,
        verified: data.verified || data.is_blue_verified,
        bio: data.description || data.bio
      }

      // Include recent tweets if scraped
      if (includePosts && data.tweets && data.tweets.length > 0) {
        profileData.recentPosts = data.tweets.map((t: any) => ({
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

        // Calculate median views for outlier detection
        const views = profileData.recentPosts.map((p: any) => p.views || p.likes * 20)
        if (views.length > 0) {
          views.sort((a: number, b: number) => a - b)
          const mid = Math.floor(views.length / 2)
          profileData.medianViews = views.length % 2 !== 0
            ? views[mid]
            : (views[mid - 1] + views[mid]) / 2
        }
      }

      results.set(username, profileData)
    }

    console.log(`  ✓ Retrieved ${results.size} Twitter profiles`)
  } catch (error: any) {
    console.error(`  ✗ Twitter enrichment failed: ${error.message}`)
  }

  return results
}

async function enrichYouTube(
  client: ApifyClient,
  channelUrls: string[],
  dryRun: boolean
): Promise<Map<string, any>> {
  console.log(`\nEnriching ${channelUrls.length} YouTube channels...`)

  if (dryRun) {
    console.log('  [DRY RUN] Would scrape:', channelUrls.join(', '))
    return new Map()
  }

  const results = new Map<string, any>()

  try {
    const run = await client.actor(ACTORS.youtube).call({
      channelUrls,
      maxVideos: 0 // Just get channel info
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    for (const item of items) {
      const data = item as any
      // Extract handle from URL for matching
      const handle = data.channelUrl?.match(/@([^/]+)/)?.[1]?.toLowerCase()
      if (handle) {
        results.set(handle, {
          subscribers: data.subscriberCount,
          videos: data.videoCount,
          views: data.viewCount,
          description: data.description
        })
      }
    }

    console.log(`  ✓ Retrieved ${results.size} YouTube channels`)
  } catch (error: any) {
    console.error(`  ✗ YouTube enrichment failed: ${error.message}`)
  }

  return results
}

function updateDatabase(
  db: Database,
  platformData: Map<string, Map<string, any>>,
  dryRun: boolean
): number {
  let updatedCount = 0
  const allInfluencers = [...db.influencers, ...(db.organizations || [])]

  for (const influencer of allInfluencers) {
    let totalFollowers = 0
    let updated = false

    for (const handle of influencer.handles) {
      const platformResults = platformData.get(handle.platform)
      if (!platformResults) continue

      const data = platformResults.get(handle.username.toLowerCase())
      if (!data) continue

      // Update handle followers
      if (data.followers || data.subscribers) {
        const followers = data.followers || data.subscribers
        if (!dryRun) {
          handle.followers = followers
        }
        totalFollowers += followers
        updated = true
        console.log(`  Updated ${influencer.name} @${handle.username}: ${followers.toLocaleString()} followers`)
      }

      // Update verified status
      if (data.verified !== undefined && !dryRun) {
        handle.verified = data.verified
      }

      // Update recent posts for viral detection
      if (data.recentPosts && data.recentPosts.length > 0 && !dryRun) {
        handle.recentPosts = data.recentPosts
        handle.medianViews = data.medianViews
        console.log(`    + ${data.recentPosts.length} posts captured (median: ${data.medianViews?.toLocaleString() || 'N/A'} views)`)
      }
    }

    // Update total metrics
    if (updated && !dryRun) {
      influencer.metrics = {
        ...influencer.metrics,
        totalFollowers,
        lastUpdated: new Date().toISOString()
      }
      updatedCount++
    }
  }

  return updatedCount
}

function loadDatabase(brand: string): Database | null {
  const path = getIntelPath(brand, 'influencers.json')
  if (!existsSync(path)) {
    console.error(`Database not found for brand: ${brand}`)
    return null
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function saveDatabase(db: Database, brand: string): void {
  const path = getIntelPath(brand, 'influencers.json')
  ensureIntelDir(brand)
  db.lastUpdated = new Date().toISOString()
  writeFileSync(path, JSON.stringify(db, null, 2))
  console.log(`\nDatabase saved to: ${path}`)
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args.find(a => !a.startsWith('--')) || getDefaultBrand()
  const platformArg = args.find(a => a.startsWith('--platform='))
  const filterPlatform = platformArg?.split('=')[1]
  const dryRun = args.includes('--dry-run')
  const includePosts = args.includes('--include-posts')

  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken && !dryRun) {
    console.error('APIFY_API_TOKEN not set in environment')
    console.error('Run with --dry-run to see what would be scraped')
    process.exit(1)
  }

  const db = loadDatabase(brand)
  if (!db) process.exit(1)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`ENRICHING: ${brand.toUpperCase()}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (filterPlatform) console.log(`Platform filter: ${filterPlatform}`)
  console.log(`${'='.repeat(60)}`)

  const client = dryRun ? null : new ApifyClient({ token: apiToken })
  const allInfluencers = [...db.influencers, ...(db.organizations || [])]

  // Collect handles by platform
  const handlesByPlatform = new Map<string, string[]>()
  const urlsByPlatform = new Map<string, string[]>()

  for (const inf of allInfluencers) {
    for (const handle of inf.handles) {
      if (filterPlatform && handle.platform !== filterPlatform) continue

      const usernames = handlesByPlatform.get(handle.platform) || []
      usernames.push(handle.username)
      handlesByPlatform.set(handle.platform, usernames)

      const urls = urlsByPlatform.get(handle.platform) || []
      urls.push(handle.url)
      urlsByPlatform.set(handle.platform, urls)
    }
  }

  // Print summary
  console.log('\nHandles to enrich:')
  for (const [platform, usernames] of handlesByPlatform.entries()) {
    console.log(`  ${platform}: ${usernames.length}`)
  }

  // Enrich each platform
  const platformData = new Map<string, Map<string, any>>()

  if (handlesByPlatform.has('instagram') && client) {
    const igUsernames = handlesByPlatform.get('instagram')!
    const igData = await enrichInstagram(client, igUsernames, dryRun, includePosts)
    platformData.set('instagram', igData)
  }

  if (handlesByPlatform.has('tiktok') && client) {
    const ttUsernames = handlesByPlatform.get('tiktok')!
    const ttData = await enrichTikTok(client, ttUsernames, dryRun)
    platformData.set('tiktok', ttData)
  }

  if (handlesByPlatform.has('youtube') && client) {
    const ytUrls = urlsByPlatform.get('youtube')!
    const ytData = await enrichYouTube(client, ytUrls, dryRun)
    platformData.set('youtube', ytData)
  }

  if (handlesByPlatform.has('twitter') && client) {
    const twUsernames = handlesByPlatform.get('twitter')!
    const twData = await enrichTwitter(client, twUsernames, dryRun, includePosts)
    platformData.set('twitter', twData)
  }

  // Update database
  console.log('\n--- Updating Database ---')
  const updatedCount = updateDatabase(db, platformData, dryRun)

  if (!dryRun && updatedCount > 0) {
    saveDatabase(db, brand)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`COMPLETE: Updated ${updatedCount} influencers`)
  console.log(`${'='.repeat(60)}`)
}

main().catch(console.error)
