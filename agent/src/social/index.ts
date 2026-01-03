/**
 * Unified social posting interface
 * Routes to platform-specific direct API implementations
 */

import type { Platform, Brand } from '../core/types'

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
  try {
    switch (platform) {
      case 'twitter': {
        const { postToTwitter } = await import('./twitter-direct')
        return postToTwitter(brand, text, imageUrl)
      }

      case 'linkedin': {
        const { postToLinkedIn } = await import('./linkedin-direct')
        return postToLinkedIn(brand, text, imageUrl)
      }

      case 'facebook': {
        const { postToFacebook } = await import('./facebook-direct')
        return postToFacebook(brand, text, imageUrl)
      }

      case 'instagram': {
        const { postToInstagram } = await import('./instagram-direct')
        if (!imageUrl) {
          return { platform, success: false, error: 'Instagram requires an image' }
        }
        return postToInstagram(brand, imageUrl, text)
      }

      case 'threads': {
        const { postToThreads } = await import('./threads-direct')
        return postToThreads(brand, text, imageUrl)
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
    const { uploadShort } = await import('./youtube-direct')
    return uploadShort(brand, videoPath, title, description, options)
  } catch (error: any) {
    return { platform: 'youtube', success: false, error: error.message }
  }
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
