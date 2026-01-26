/**
 * Unified social posting interface
 * Routes to platform-specific direct API implementations
 */

import type { Platform, Brand } from '../core/types'
import { checkRateLimit, getRateLimitStatus } from '../core/rate-limit'
import { uploadToR2, isR2Configured } from '../core/r2'

export interface PostResult {
  platform: Platform
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

export interface PostOptions {
  brand: Brand
  text: string
  imageUrl?: string
  platforms: Platform[]
}

/**
 * Post to a single platform
 */
export async function postToPlatform(
  platform: Platform,
  brand: Brand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  // Check rate limit before posting
  const rateCheck = checkRateLimit(platform, brand)
  if (!rateCheck.allowed) {
    const waitSec = Math.ceil((rateCheck.waitMs || 0) / 1000)
    return {
      platform,
      success: false,
      error: `Rate limited. Try again in ${waitSec} seconds.`
    }
  }

  try {
    switch (platform) {
      case 'twitter': {
        const { postToTwitter } = await import('./twitter-direct')
        const result = await postToTwitter(brand, text, imageUrl)
        return { platform, ...result }
      }

      case 'linkedin': {
        const { postToLinkedIn } = await import('./linkedin-direct')
        const result = await postToLinkedIn(brand, text, imageUrl)
        return { platform, ...result }
      }

      case 'facebook': {
        const { postToFacebook } = await import('./facebook-direct')
        const result = await postToFacebook(brand, text, imageUrl)
        return { platform, ...result }
      }

      case 'instagram': {
        const { postToInstagram } = await import('./instagram-direct')
        if (!imageUrl) {
          return { platform, success: false, error: 'Instagram requires an image' }
        }
        // Instagram requires public URL - upload local files to R2
        let publicImageUrl = imageUrl
        if (!imageUrl.startsWith('http')) {
          if (!isR2Configured()) {
            return { platform, success: false, error: 'Instagram requires public URL. Configure R2 for local file uploads.' }
          }
          console.log(`[social] Uploading to R2 for Instagram...`)
          publicImageUrl = await uploadToR2(imageUrl)
        }
        const result = await postToInstagram(brand, text, publicImageUrl)
        return { platform, ...result }
      }

      case 'threads': {
        const { postToThreads } = await import('./threads-direct')
        // Threads requires public URL - upload local files to R2
        let publicImageUrl = imageUrl
        if (imageUrl && !imageUrl.startsWith('http')) {
          if (!isR2Configured()) {
            return { platform, success: false, error: 'Threads requires public URL. Configure R2 for local file uploads.' }
          }
          console.log(`[social] Uploading to R2 for Threads...`)
          publicImageUrl = await uploadToR2(imageUrl)
        }
        const result = await postToThreads(brand, text, publicImageUrl)
        return { platform, ...result }
      }

      case 'youtube': {
        return { platform, success: false, error: 'YouTube requires video upload - use uploadYouTubeShort()' }
      }

      default:
        return { platform, success: false, error: `Unknown platform: ${platform}` }
    }
  } catch (error: any) {
    return { platform, success: false, error: error.message }
  }
}

/**
 * Post to multiple platforms
 */
export async function postToAll(options: PostOptions): Promise<PostResult[]> {
  const { brand, text, imageUrl, platforms } = options
  const results: PostResult[] = []

  console.log(`\nPosting to ${platforms.length} platforms for ${brand}...`)

  for (const platform of platforms) {
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
  console.log(`\nPosted to ${succeeded}/${platforms.length} platforms`)

  return results
}

/**
 * Upload and post YouTube Short
 */
export async function uploadYouTubeShort(
  brand: Brand,
  videoPath: string,
  title: string,
  description: string,
  options: {
    tags?: string[]
    privacyStatus?: 'public' | 'private' | 'unlisted'
  } = {}
): Promise<PostResult> {
  try {
    const { uploadToYouTube } = await import('./youtube-direct')
    const result = await uploadToYouTube(brand, videoPath, title, description, { ...options, isShort: true })
    return { platform: 'youtube', ...result }
  } catch (error: any) {
    return { platform: 'youtube', success: false, error: error.message }
  }
}

/**
 * Get rate limit status for all platforms
 */
export function getAllRateLimitStatus(brand: Brand): Record<Platform, { remaining: number; total: number }> {
  const platforms: Platform[] = ['twitter', 'linkedin', 'facebook', 'instagram', 'threads', 'youtube']
  const status: Record<string, { remaining: number; total: number }> = {}

  for (const platform of platforms) {
    const s = getRateLimitStatus(platform, brand)
    status[platform] = { remaining: s.remaining, total: s.total }
  }

  return status as Record<Platform, { remaining: number; total: number }>
}

/**
 * Check which platforms have valid credentials
 */
export function getAvailablePlatforms(brand: Brand): Platform[] {
  const available: Platform[] = []
  const prefix = brand.toUpperCase()

  // Twitter
  if (process.env[`TWITTER_${prefix}_API_KEY`] && process.env[`TWITTER_${prefix}_ACCESS_TOKEN`]) {
    available.push('twitter')
  }

  // LinkedIn
  if (process.env[`LINKEDIN_${prefix}_ACCESS_TOKEN`] && process.env[`LINKEDIN_${prefix}_ORG_ID`]) {
    available.push('linkedin')
  }

  // Facebook
  if (process.env[`FACEBOOK_${prefix}_PAGE_ACCESS_TOKEN`] && process.env[`FACEBOOK_${prefix}_PAGE_ID`]) {
    available.push('facebook')
  }

  // Instagram
  if (process.env[`INSTAGRAM_${prefix}_ACCESS_TOKEN`] && process.env[`INSTAGRAM_${prefix}_USER_ID`]) {
    available.push('instagram')
  }

  // Threads
  if (process.env[`THREADS_${prefix}_ACCESS_TOKEN`] && process.env[`THREADS_${prefix}_USER_ID`]) {
    available.push('threads')
  }

  // YouTube
  if (process.env[`YOUTUBE_${prefix}_REFRESH_TOKEN`] && process.env[`YOUTUBE_${prefix}_CHANNEL_ID`]) {
    available.push('youtube')
  }

  return available
}
