/**
 * Arcade-based social media posting
 * Handles OAuth and posting to Twitter/LinkedIn
 */

import Arcade from '@arcadeai/arcadejs'

// Tool names in Arcade
const TOOLS = {
  twitter: 'X.PostTweet',
  linkedin: 'Linkedin.CreateTextPost'
} as const

export interface ArcadeAuthResult {
  platform: 'twitter' | 'linkedin'
  authorized: boolean
  authUrl?: string
  authId?: string
}

export interface ArcadePostResult {
  platform: 'twitter' | 'linkedin'
  success: boolean
  postUrl?: string
  postId?: string
  error?: string
  needsAuth?: boolean
  authUrl?: string
}

/**
 * Get Arcade client instance
 */
function getClient(): Arcade {
  const apiKey = process.env.ARCADE_API_KEY
  if (!apiKey) {
    throw new Error('ARCADE_API_KEY not set')
  }
  return new Arcade({ apiKey })
}

/**
 * Get user ID for Arcade (uses email or generates one)
 */
function getUserId(): string {
  return process.env.ARCADE_USER_ID || process.env.USER_EMAIL || 'default-user'
}

/**
 * Check authorization status for a platform
 */
export async function checkAuth(platform: 'twitter' | 'linkedin'): Promise<ArcadeAuthResult> {
  const client = getClient()
  const userId = getUserId()
  const toolName = TOOLS[platform]

  try {
    const response = await client.tools.authorize({
      tool_name: toolName,
      user_id: userId
    })

    if (response.status === 'completed') {
      return { platform, authorized: true }
    }

    return {
      platform,
      authorized: false,
      authUrl: response.url,
      authId: response.id
    }
  } catch (error) {
    console.error(`[arcade] Auth check failed for ${platform}:`, error)
    return { platform, authorized: false }
  }
}

/**
 * Wait for authorization to complete
 */
export async function waitForAuth(authId: string): Promise<boolean> {
  const client = getClient()

  try {
    await client.auth.waitForCompletion(authId)
    return true
  } catch (error) {
    console.error('[arcade] Auth wait failed:', error)
    return false
  }
}

/**
 * Post to Twitter/X
 */
export async function postToTwitter(
  text: string,
  imageUrl?: string
): Promise<ArcadePostResult> {
  const client = getClient()
  const userId = getUserId()

  console.log(`[arcade] Posting to Twitter...`)

  try {
    // Check auth first
    const authResponse = await client.tools.authorize({
      tool_name: TOOLS.twitter,
      user_id: userId
    })

    if (authResponse.status !== 'completed') {
      console.log(`[arcade] Twitter auth required: ${authResponse.url}`)
      return {
        platform: 'twitter',
        success: false,
        needsAuth: true,
        authUrl: authResponse.url
      }
    }

    // Execute the post
    const response = await client.tools.execute({
      tool_name: TOOLS.twitter,
      input: { tweet_text: text },
      user_id: userId
    })

    const output = response.output as any

    console.log(`[arcade] Twitter post success`)

    return {
      platform: 'twitter',
      success: true,
      postId: output?.id || output?.value?.id,
      postUrl: output?.url || (output?.id ? `https://twitter.com/i/status/${output.id}` : undefined)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[arcade] Twitter post failed:`, message)
    return {
      platform: 'twitter',
      success: false,
      error: message
    }
  }
}

/**
 * Post to LinkedIn
 */
export async function postToLinkedIn(
  text: string,
  imageUrl?: string
): Promise<ArcadePostResult> {
  const client = getClient()
  const userId = getUserId()

  console.log(`[arcade] Posting to LinkedIn...`)

  try {
    // Check auth first
    const authResponse = await client.tools.authorize({
      tool_name: TOOLS.linkedin,
      user_id: userId
    })

    if (authResponse.status !== 'completed') {
      console.log(`[arcade] LinkedIn auth required: ${authResponse.url}`)
      return {
        platform: 'linkedin',
        success: false,
        needsAuth: true,
        authUrl: authResponse.url
      }
    }

    // Execute the post
    const response = await client.tools.execute({
      tool_name: TOOLS.linkedin,
      input: { text },
      user_id: userId
    })

    const output = response.output as any

    console.log(`[arcade] LinkedIn post success`)

    return {
      platform: 'linkedin',
      success: true,
      postId: output?.id || output?.value?.id,
      postUrl: output?.url || output?.value?.url
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[arcade] LinkedIn post failed:`, message)
    return {
      platform: 'linkedin',
      success: false,
      error: message
    }
  }
}

/**
 * Post to multiple platforms
 */
export async function postToAll(
  content: {
    twitter?: { text: string; hashtags: string[] }
    linkedin?: { text: string; hashtags: string[] }
  },
  imageUrl?: string
): Promise<ArcadePostResult[]> {
  const results: ArcadePostResult[] = []

  if (content.twitter) {
    const text = `${content.twitter.text}\n\n${content.twitter.hashtags.map(h => `#${h}`).join(' ')}`
    results.push(await postToTwitter(text, imageUrl))
  }

  if (content.linkedin) {
    const text = `${content.linkedin.text}\n\n${content.linkedin.hashtags.map(h => `#${h}`).join(' ')}`
    results.push(await postToLinkedIn(text, imageUrl))
  }

  return results
}

/**
 * Get auth status for all platforms
 */
export async function getAuthStatus(): Promise<ArcadeAuthResult[]> {
  const platforms: ('twitter' | 'linkedin')[] = ['twitter', 'linkedin']
  const results: ArcadeAuthResult[] = []

  for (const platform of platforms) {
    results.push(await checkAuth(platform))
  }

  return results
}
