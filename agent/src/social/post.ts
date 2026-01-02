/**
 * @deprecated This file uses Composio stubs that never worked.
 * Use the direct API implementations instead:
 * - twitter-direct.ts
 * - linkedin-direct.ts
 * - facebook-direct.ts
 * - instagram-direct.ts
 * - threads-direct.ts
 * - youtube-direct.ts
 *
 * This file is kept for backwards compatibility but all functions
 * return success: false to avoid false positives.
 */

import type { ContentItem, QueueItem } from '../types'
import { updateQueueItem, getByStage } from '../queue'

console.warn('[DEPRECATED] agent/src/social/post.ts is deprecated. Use *-direct.ts implementations.')

export interface PostResult {
  platform: 'twitter' | 'linkedin'
  success: boolean
  postUrl?: string
  error?: string
  postedAt?: string
}

/**
 * Post to Twitter
 * Uses Composio or direct API
 */
async function postToTwitter(
  text: string,
  hashtags: string[],
  imageUrl?: string
): Promise<PostResult> {
  const fullText = `${text}\n\n${hashtags.map(h => `#${h}`).join(' ')}`

  console.log(`[post] Twitter: ${fullText.slice(0, 50)}...`)

  // Check for Composio
  if (process.env.COMPOSIO_API_KEY) {
    try {
      // Composio posting would go here
      console.log('[post] Would post to Twitter via Composio')
      return {
        platform: 'twitter',
        success: false,
        error: 'Composio integration not implemented - use twitter-direct.ts instead'
      }
    } catch (error) {
      return {
        platform: 'twitter',
        success: false,
        error: error instanceof Error ? error.message : 'Composio error'
      }
    }
  }

  // No credentials - return failure (not false positive)
  console.warn('[post] Twitter: no COMPOSIO_API_KEY - use twitter-direct.ts for actual posting')
  return {
    platform: 'twitter',
    success: false,
    error: 'Twitter posting not configured - use direct API (twitter-direct.ts)'
  }
}

/**
 * Post to LinkedIn
 * Uses Composio or direct API
 */
async function postToLinkedIn(
  text: string,
  hashtags: string[],
  imageUrl?: string
): Promise<PostResult> {
  const fullText = `${text}\n\n${hashtags.map(h => `#${h}`).join(' ')}`

  console.log(`[post] LinkedIn: ${fullText.slice(0, 50)}...`)

  // Check for Composio
  if (process.env.COMPOSIO_API_KEY) {
    try {
      // Composio posting would go here
      console.log('[post] Would post to LinkedIn via Composio')
      return {
        platform: 'linkedin',
        success: false,
        error: 'Composio integration not implemented - use linkedin-direct.ts instead'
      }
    } catch (error) {
      return {
        platform: 'linkedin',
        success: false,
        error: error instanceof Error ? error.message : 'Composio error'
      }
    }
  }

  // No credentials - return failure (not false positive)
  console.warn('[post] LinkedIn: no COMPOSIO_API_KEY - use linkedin-direct.ts for actual posting')
  return {
    platform: 'linkedin',
    success: false,
    error: 'LinkedIn posting not configured - use direct API (linkedin-direct.ts)'
  }
}

/**
 * Post content to specified platforms
 */
export async function postContent(
  item: ContentItem,
  platforms: ('twitter' | 'linkedin')[] = ['twitter', 'linkedin']
): Promise<PostResult[]> {
  const results: PostResult[] = []

  if (!item.content) {
    throw new Error('No content to post')
  }

  for (const platform of platforms) {
    const platformContent = item.content[platform]

    if (!platformContent) {
      results.push({
        platform,
        success: false,
        error: `No ${platform} content`
      })
      continue
    }

    const result = platform === 'twitter'
      ? await postToTwitter(platformContent.text, platformContent.hashtags, item.image?.url)
      : await postToLinkedIn(platformContent.text, platformContent.hashtags, item.image?.url)

    results.push(result)
  }

  return results
}

/**
 * Process all items in the post queue
 */
export async function processPostQueue(): Promise<void> {
  const items = getByStage('post')

  if (items.length === 0) {
    console.log('[post] No items in post queue')
    return
  }

  console.log(`[post] Processing ${items.length} items`)

  for (const item of items) {
    try {
      const results = await postContent(item)

      const allSuccess = results.every(r => r.success)
      updateQueueItem(item.id, {
        posts: results,
        stage: allSuccess ? 'done' : 'failed',
        error: allSuccess ? undefined : results.find(r => !r.success)?.error
      })

      console.log(`[post] ${item.id}: ${allSuccess ? 'success' : 'failed'}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateQueueItem(item.id, {
        stage: 'failed',
        error: errorMessage
      })
      console.error(`[post] ${item.id} error:`, errorMessage)
    }
  }
}

/**
 * Post a single item by ID
 */
export async function postById(
  id: string,
  platforms: ('twitter' | 'linkedin')[] = ['twitter', 'linkedin']
): Promise<PostResult[]> {
  const items = getByStage('post')
  const item = items.find(i => i.id === id)

  if (!item) {
    throw new Error(`Item not found or not ready for posting: ${id}`)
  }

  const results = await postContent(item, platforms)

  const allSuccess = results.every(r => r.success)
  updateQueueItem(id, {
    posts: results,
    stage: allSuccess ? 'done' : 'failed',
    error: allSuccess ? undefined : results.find(r => !r.success)?.error
  })

  return results
}
