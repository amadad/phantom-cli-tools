/**
 * Direct YouTube API integration
 * Uses YouTube Data API v3 for uploading videos and Shorts
 */

import { statSync } from 'fs'
import { discoverBrands } from '../core/paths'
import type { Brand } from '../core/types'

export type YouTubeBrand = Brand

interface YouTubeCredentials {
  accessToken: string
  refreshToken: string
  channelId: string
  clientId: string
  clientSecret: string
}

interface UploadResult {
  success: boolean
  videoId?: string
  videoUrl?: string
  error?: string
}

/**
 * Get credentials for a brand
 */
function getCredentials(brand: YouTubeBrand): YouTubeCredentials {
  const brandUpper = brand.toUpperCase()

  const accessToken = process.env[`YOUTUBE_${brandUpper}_ACCESS_TOKEN`]
  const refreshToken = process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`]
  const channelId = process.env[`YOUTUBE_${brandUpper}_CHANNEL_ID`]
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

  if (!accessToken) {
    throw new Error(`YOUTUBE_${brandUpper}_ACCESS_TOKEN not set. Run: npx tsx youtube-auth.ts`)
  }

  if (!refreshToken) {
    throw new Error(`YOUTUBE_${brandUpper}_REFRESH_TOKEN not set`)
  }

  if (!channelId) {
    throw new Error(`YOUTUBE_${brandUpper}_CHANNEL_ID not set`)
  }

  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set')
  }

  return { accessToken, refreshToken, channelId, clientId, clientSecret }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(creds: YouTubeCredentials): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Upload a video to YouTube
 * For Shorts: video should be vertical (9:16) and under 60 seconds
 * Add #Shorts to title or description for Shorts
 */
export async function uploadToYouTube(
  brand: YouTubeBrand,
  videoPath: string,
  title: string,
  description: string,
  options: {
    isShort?: boolean
    tags?: string[]
    privacyStatus?: 'public' | 'private' | 'unlisted'
  } = {}
): Promise<UploadResult> {
  try {
    const creds = getCredentials(brand)

    // Check if file exists
    const stats = statSync(videoPath)
    if (!stats.isFile()) {
      throw new Error(`Video file not found: ${videoPath}`)
    }

    // Refresh token in case it's expired
    console.log(`[youtube-direct] Refreshing access token for ${brand}...`)
    const accessToken = await refreshAccessToken(creds)

    // For Shorts, add #Shorts to title if not present
    let finalTitle = title
    if (options.isShort && !title.includes('#Shorts')) {
      finalTitle = `${title} #Shorts`
    }

    // Prepare metadata
    const metadata = {
      snippet: {
        title: finalTitle,
        description: description,
        tags: options.tags || [],
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: options.privacyStatus || 'private',
        selfDeclaredMadeForKids: false
      }
    }

    console.log(`[youtube-direct] Uploading video for ${brand}...`)
    console.log(`[youtube-direct] File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`)

    // Read file as buffer
    const fs = await import('fs/promises')
    const videoData = await fs.readFile(videoPath)

    // Create multipart body
    const boundary = '===============' + Date.now() + '=='
    const metadataJson = JSON.stringify(metadata)

    const bodyParts = [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataJson,
      `\r\n--${boundary}\r\n`,
      'Content-Type: video/*\r\n\r\n',
    ]

    const bodyStart = Buffer.from(bodyParts.join(''))
    const bodyEnd = Buffer.from(`\r\n--${boundary}--`)
    const body = Buffer.concat([bodyStart, videoData, bodyEnd])

    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': body.length.toString()
        },
        body
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Upload failed: ${response.status} ${text}`)
    }

    const data = await response.json()
    const videoUrl = options.isShort
      ? `https://youtube.com/shorts/${data.id}`
      : `https://youtube.com/watch?v=${data.id}`

    console.log(`[youtube-direct] Video uploaded: ${videoUrl}`)

    return {
      success: true,
      videoId: data.id,
      videoUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[youtube-direct] Error uploading for ${brand}:`, message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Check if credentials are configured for a brand
 */
export function hasCredentials(brand: YouTubeBrand): boolean {
  try {
    getCredentials(brand)
    return true
  } catch {
    return false
  }
}

/**
 * Get configured brands
 */
export function getConfiguredBrands(): YouTubeBrand[] {
  return discoverBrands().filter((brand: string) => hasCredentials(brand as YouTubeBrand))
}
