/**
 * Post command - Publish queued content to social platforms
 *
 * Usage:
 *   post <brand> [options]
 *
 * Options:
 *   --platforms=twitter,linkedin   Specific platforms (comma-separated)
 *   --all                          Post to all available platforms
 *   --id=<id>                      Post specific queue item
 *   --dry-run                      Show what would be posted
 */

import { postToPlatform, getAvailablePlatforms, type PostResult } from '../publish'
import { loadQueue, saveQueue, getQueueItem } from '../queue'
import type { Platform, Brand, QueueItem } from '../core/types'
import { existsSync } from 'fs'
import { dirname, join, basename } from 'path'
import type { CommandContext } from '../cli/types'

// Platforms that have text content (excludes youtube which is video-only)
type TextPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads'

export interface PostOptions {
  brand: Brand
  platforms?: Platform[]
  all?: boolean
  queueId?: string
  dryRun?: boolean
}

export interface PostPreview {
  platform: Platform
  text: string
  image?: string
}

export interface PostSummary {
  brand: Brand
  queueId: string
  stage: QueueItem['stage']
  platforms: Platform[]
  dryRun: boolean
  results?: PostResult[]
  preview?: PostPreview[]
}

/**
 * Get text for a platform from queue item
 */
function getTextForPlatform(item: QueueItem, platform: Platform): string {
  // Only text platforms have content; youtube is video-only
  const textPlatform = platform as TextPlatform
  const content = item.content[textPlatform] || item.content.twitter
  if (!content) return ''
  return `${content.text}\n\n${content.hashtags.map((h: string) => `#${h}`).join(' ')}`
}

/**
 * Get image URL for a platform from queue item
 * Derives platform-specific path from base image (e.g., twitter.png → instagram.png)
 */
function getImageForPlatform(item: QueueItem, platform: Platform): string | undefined {
  const baseUrl = item.image?.url
  if (!baseUrl) return undefined

  // If it's a remote URL, use as-is
  if (baseUrl.startsWith('http')) return baseUrl

  // For local files, try platform-specific image first
  const dir = dirname(baseUrl)
  const platformImage = join(dir, `${platform}.png`)

  if (existsSync(platformImage)) {
    return platformImage
  }

  // Fallback to base image
  return baseUrl
}

export async function post(options: PostOptions): Promise<PostSummary | null> {
  const { brand, platforms, all, queueId, dryRun } = options

  // Load queue for THIS BRAND ONLY
  const queue = loadQueue(brand)

  if (queue.length === 0) {
    console.log(`Queue for ${brand} is empty. Run "explore ${brand}" first to create content.`)
    return null
  }

  // Find item to post
  let item: QueueItem | undefined
  let itemIndex: number = -1

  if (queueId) {
    itemIndex = queue.findIndex(q => q.id === queueId)
    item = queue[itemIndex]
    if (!item) {
      throw new Error(`Queue item not found: ${queueId} in ${brand}`)
    }
  } else {
    // Get most recent review item for THIS BRAND
    itemIndex = queue.findIndex(q => q.stage === 'review')
    item = queue[itemIndex]
    if (!item) {
      console.log(`No items pending review for ${brand}. All items have been posted or failed.`)
      console.log('\nQueue status:')
      for (const q of queue.slice(-5)) {
        console.log(`  [${q.stage}] ${q.id}: ${q.content.topic}`)
      }
      return null
    }
  }

  console.log(`\nPosting: ${item.id}`)
  console.log(`Topic: ${item.content.topic}`)

  // Determine platforms
  let targetPlatforms: Platform[]

  // Video-only platforms can't receive text posts
  const videoOnly: Platform[] = ['youtube']

  if (all) {
    targetPlatforms = getAvailablePlatforms(brand).filter(p => !videoOnly.includes(p))
  } else if (platforms && platforms.length > 0) {
    targetPlatforms = platforms
  } else {
    // Default to twitter + linkedin
    const available = getAvailablePlatforms(brand)
    targetPlatforms = available.filter(p => ['twitter', 'linkedin'].includes(p))
  }

  if (targetPlatforms.length === 0) {
    console.error('No platforms available. Check your credentials.')
    console.log('\nRequired env vars per platform:')
    console.log('  Twitter: TWITTER_<BRAND>_API_KEY, TWITTER_<BRAND>_ACCESS_TOKEN')
    console.log('  LinkedIn: LINKEDIN_<BRAND>_ACCESS_TOKEN, LINKEDIN_<BRAND>_ORG_ID')
    throw new Error('No platforms available')
  }

  console.log(`Platforms: ${targetPlatforms.join(', ')}`)

  // Pre-flight token check — auto-refresh if possible, warn if not
  if (!dryRun) {
    const { preflightTokenCheck } = await import('../publish/token-refresh')
    const { ready, failed } = await preflightTokenCheck(brand, targetPlatforms)

    if (failed.length > 0) {
      console.log('\nToken issues:')
      for (const f of failed) {
        console.log(`  [${f.platform}] ${f.message}`)
      }
    }

    if (ready.length === 0) {
      throw new Error('No platforms have valid tokens. Run "token refresh" or re-auth manually.')
    }

    if (ready.length < targetPlatforms.length) {
      const skipped = targetPlatforms.filter(p => !ready.includes(p))
      console.log(`\nSkipping: ${skipped.join(', ')} (token issues)`)
      targetPlatforms = ready as Platform[]
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would post:')
    const preview: PostPreview[] = []
    for (const platform of targetPlatforms) {
      const text = getTextForPlatform(item, platform)
      const imageUrl = getImageForPlatform(item, platform)
      preview.push({ platform, text, image: imageUrl })
      console.log(`\n--- ${platform.toUpperCase()} ---`)
      console.log(text.slice(0, 200) + (text.length > 200 ? '...' : ''))
      console.log(`Image: ${imageUrl ? basename(imageUrl) : 'None'}`)
    }
    return {
      brand,
      queueId: item.id,
      stage: item.stage,
      platforms: targetPlatforms,
      dryRun: true,
      preview
    }
  }

  // Post to platforms with per-platform text and image
  const results: PostResult[] = []

  console.log(`\nPosting to ${targetPlatforms.length} platforms for ${brand}...`)

  for (const platform of targetPlatforms) {
    const text = getTextForPlatform(item, platform)
    const imageUrl = getImageForPlatform(item, platform)
    console.log(`  [${platform}] Posting...${imageUrl ? ` (${basename(imageUrl)})` : ''}`)
    const result = await postToPlatform(platform, brand, text, imageUrl)
    results.push(result)

    if (result.success) {
      console.log(`  [${platform}] ✓ ${result.postUrl || 'Posted'}`)
    } else {
      console.log(`  [${platform}] ✗ ${result.error}`)
    }
  }

  const succeeded = results.filter(r => r.success).length
  console.log(`\nPosted to ${succeeded}/${targetPlatforms.length} platforms`)

  // Update queue
  const now = new Date().toISOString()
  const allSuccess = results.every(r => r.success)

  queue[itemIndex] = {
    ...item,
    stage: allSuccess ? 'done' : 'failed',
    updatedAt: now,
    posts: results.map(r => ({
      platform: r.platform,
      success: r.success,
      postUrl: r.postUrl,
      error: r.error,
      postedAt: r.success ? now : undefined
    }))
  }

  saveQueue(brand, queue)

  // Print results
  console.log(`\n${'─'.repeat(60)}`)
  if (allSuccess) {
    console.log('✓ Posted successfully!')
  } else {
    console.log('⚠️  Some posts failed')
  }

  for (const r of results) {
    if (r.success) {
      console.log(`  [${r.platform}] ✓ ${r.postUrl || 'Posted'}`)
    } else {
      console.log(`  [${r.platform}] ✗ ${r.error}`)
    }
  }

  return {
    brand,
    queueId: item.id,
    stage: queue[itemIndex].stage,
    platforms: targetPlatforms,
    dryRun: false,
    results
  }
}

/**
 * Parse CLI args and run
 */
export async function run(args: string[], _ctx?: CommandContext): Promise<PostSummary | null> {
  // Find brand
  const { discoverBrands, getDefaultBrand } = await import('../core/paths')
  const brands = discoverBrands()
  const brand = (args.find(a => brands.includes(a)) || getDefaultBrand()) as Brand

  // Parse platforms
  let platforms: Platform[] | undefined
  const platformsArg = args.find(a => a.startsWith('--platforms='))
  if (platformsArg) {
    const value = platformsArg.split('=')[1]?.trim()
    if (!value) {
      console.warn('--platforms requires a value (e.g. --platforms=twitter,linkedin)')
    } else {
      platforms = value.split(',').filter(Boolean) as Platform[]
    }
  }

  // Parse queue ID
  let queueId: string | undefined
  const idArg = args.find(a => a.startsWith('--id='))
  if (idArg) {
    const value = idArg.split('=')[1]?.trim()
    if (!value) {
      console.warn('--id requires a value (e.g. --id=gen_123)')
    } else {
      queueId = value
    }
  }

  return post({
    brand,
    platforms,
    all: args.includes('--all'),
    queueId,
    dryRun: args.includes('--dry-run')
  })
}
