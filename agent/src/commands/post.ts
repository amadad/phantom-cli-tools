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

import { postToPlatform, getAvailablePlatforms, type PostResult } from '../social'
import { loadQueue, saveQueue, getQueueItem } from '../queue'
import type { Platform, Brand, QueueItem } from '../core/types'

// Platforms that have text content (excludes youtube which is video-only)
type TextPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads'

export interface PostOptions {
  brand: Brand
  platforms?: Platform[]
  all?: boolean
  queueId?: string
  dryRun?: boolean
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

export async function post(options: PostOptions): Promise<void> {
  const { brand, platforms, all, queueId, dryRun } = options

  // Load queue
  const queue = loadQueue()

  if (queue.length === 0) {
    console.log('Queue is empty. Run "gen" first to create content.')
    return
  }

  // Find item to post
  let item: QueueItem | undefined
  let itemIndex: number = -1

  if (queueId) {
    itemIndex = queue.findIndex(q => q.id === queueId)
    item = queue[itemIndex]
    if (!item) {
      console.error(`Queue item not found: ${queueId}`)
      process.exit(1)
    }
  } else {
    // Get most recent review item
    itemIndex = queue.findIndex(q => q.stage === 'review')
    item = queue[itemIndex]
    if (!item) {
      console.log('No items pending review. All items have been posted or failed.')
      console.log('\nQueue status:')
      for (const q of queue.slice(-5)) {
        console.log(`  [${q.stage}] ${q.id}: ${q.content.topic}`)
      }
      return
    }
  }

  console.log(`\nPosting: ${item.id}`)
  console.log(`Topic: ${item.content.topic}`)

  // Determine platforms
  let targetPlatforms: Platform[]

  if (all) {
    targetPlatforms = getAvailablePlatforms(brand)
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
    process.exit(1)
  }

  console.log(`Platforms: ${targetPlatforms.join(', ')}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Would post:')
    for (const platform of targetPlatforms) {
      const text = getTextForPlatform(item, platform)
      console.log(`\n--- ${platform.toUpperCase()} ---`)
      console.log(text.slice(0, 200) + (text.length > 200 ? '...' : ''))
    }
    console.log('\nImage:', item.image?.url ? 'Yes' : 'No')
    return
  }

  // Post to platforms with per-platform text
  const imageUrl = item.image?.url
  const results: PostResult[] = []

  console.log(`\nPosting to ${targetPlatforms.length} platforms for ${brand}...`)

  for (const platform of targetPlatforms) {
    const text = getTextForPlatform(item, platform)
    console.log(`  [${platform}] Posting...`)
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

  saveQueue(queue)

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
}

/**
 * List queue items
 */
export function listQueue(): void {
  const queue = loadQueue()

  if (queue.length === 0) {
    console.log('Queue is empty.')
    return
  }

  console.log(`\nQueue (${queue.length} items):\n`)

  for (const item of queue) {
    const status = item.stage === 'done' ? '✓' :
                   item.stage === 'failed' ? '✗' :
                   item.stage === 'review' ? '○' : '◐'
    console.log(`${status} [${item.stage}] ${item.id}`)
    console.log(`  Topic: ${item.content.topic}`)
    console.log(`  Brand: ${item.source.brandName}`)
    console.log(`  Created: ${item.createdAt}`)
    if (item.posts && item.posts.length > 0) {
      for (const p of item.posts) {
        if (p.success) {
          console.log(`  ${p.platform}: ${p.postUrl}`)
        }
      }
    }
    console.log()
  }
}

/**
 * Parse CLI args and run
 */
export async function run(args: string[]): Promise<void> {
  // Check for list subcommand
  if (args.includes('list') || args.includes('ls')) {
    listQueue()
    return
  }

  // Find brand
  const brand = (args.find(a => ['givecare', 'scty'].includes(a)) || 'givecare') as Brand

  // Parse platforms
  let platforms: Platform[] | undefined
  const platformsArg = args.find(a => a.startsWith('--platforms='))
  if (platformsArg) {
    platforms = platformsArg.split('=')[1].split(',') as Platform[]
  }

  // Parse queue ID
  let queueId: string | undefined
  const idArg = args.find(a => a.startsWith('--id='))
  if (idArg) {
    queueId = idArg.split('=')[1]
  }

  await post({
    brand,
    platforms,
    all: args.includes('--all'),
    queueId,
    dryRun: args.includes('--dry-run')
  })
}
