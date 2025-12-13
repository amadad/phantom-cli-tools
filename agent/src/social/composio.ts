/**
 * Composio-based social media posting
 * Handles OAuth and posting to Twitter, LinkedIn, Instagram, Facebook
 */

import { Composio } from '@composio/core'

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'facebook'

// Toolkit slugs (same as platform names)
const TOOLKIT_SLUGS: Record<Platform, string> = {
  twitter: 'twitter',
  linkedin: 'linkedin',
  instagram: 'instagram',
  facebook: 'facebook'
}

// Tool slugs for posting
const POST_TOOLS: Record<Platform, string> = {
  twitter: 'TWITTER_CREATION_OF_A_POST',
  linkedin: 'LINKEDIN_CREATE_LINKED_IN_POST',
  instagram: 'INSTAGRAM_CREATE_MEDIA_CONTAINER',  // TODO: verify when available
  facebook: 'FACEBOOK_CREATE_PAGE_POST'  // TODO: verify when available
}

export interface ComposioAuthResult {
  platform: Platform
  connected: boolean
  authUrl?: string
  error?: string
}

export interface ComposioPostResult {
  platform: Platform
  success: boolean
  postUrl?: string
  postId?: string
  error?: string
  needsAuth?: boolean
  authUrl?: string
}

/**
 * Get Composio client instance
 */
function getClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY not set')
  }
  return new Composio({ apiKey })
}

/**
 * Get user ID for Composio
 */
function getUserId(): string {
  return process.env.COMPOSIO_USER_ID || 'default'
}

/**
 * Get auth config ID for a toolkit
 */
async function getAuthConfigId(client: Composio, toolkit: string): Promise<string | null> {
  try {
    const configs = await client.authConfigs.list({
      toolkit,
      isComposioManaged: true
    })

    if (configs.items && configs.items.length > 0) {
      return configs.items[0].id
    }

    // Try non-managed configs
    const allConfigs = await client.authConfigs.list({ toolkit })
    if (allConfigs.items && allConfigs.items.length > 0) {
      return allConfigs.items[0].id
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if platform is connected and get auth URL if not
 */
export async function checkConnection(platform: Platform): Promise<ComposioAuthResult> {
  const client = getClient()
  const userId = getUserId()
  const toolkit = TOOLKIT_SLUGS[platform]

  try {
    // Check for existing connection
    const accounts = await client.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkit]
    })

    if (accounts.items && accounts.items.length > 0) {
      const activeAccount = accounts.items.find(a => a.status === 'ACTIVE')
      if (activeAccount) {
        return { platform, connected: true }
      }
    }

    // Get auth config and create connection
    const authConfigId = await getAuthConfigId(client, toolkit)
    if (!authConfigId) {
      return {
        platform,
        connected: false,
        error: `No auth config found for ${platform}. Set up integration at app.composio.dev`
      }
    }

    // Use initiate instead of link - it produces working OAuth URLs
    const connection = await client.connectedAccounts.initiate(userId, authConfigId, {
      allowMultiple: true
    })

    return {
      platform,
      connected: false,
      authUrl: connection.redirectUrl || undefined
    }
  } catch (error) {
    console.error(`[composio] Connection check failed for ${platform}:`, error)
    return {
      platform,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection check failed'
    }
  }
}

/**
 * Execute a posting action
 */
async function executePost(
  platform: Platform,
  params: Record<string, unknown>
): Promise<ComposioPostResult> {
  const client = getClient()
  const userId = getUserId()
  const toolkit = TOOLKIT_SLUGS[platform]

  console.log(`[composio] Posting to ${platform}...`)

  try {
    // Check connection first
    const accounts = await client.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkit]
    })

    const activeAccount = accounts.items?.find(a => a.status === 'ACTIVE')

    if (!activeAccount) {
      // Get auth URL
      const authConfigId = await getAuthConfigId(client, toolkit)
      if (!authConfigId) {
        return {
          platform,
          success: false,
          error: `No auth config for ${platform}`
        }
      }

      const connection = await client.connectedAccounts.initiate(userId, authConfigId, {
        allowMultiple: true
      })

      return {
        platform,
        success: false,
        needsAuth: true,
        authUrl: connection.redirectUrl || undefined
      }
    }

    // Execute the tool
    const response = await client.tools.execute(POST_TOOLS[platform], {
      userId,
      arguments: params,
      connectedAccountId: activeAccount.id,
      dangerouslySkipVersionCheck: true
    })

    console.log(`[composio] ${platform} post success`)

    return {
      platform,
      success: response.successful === true,
      postId: response.data?.id,
      postUrl: response.data?.url,
      error: response.successful ? undefined : response.error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[composio] ${platform} post failed:`, message)
    return {
      platform,
      success: false,
      error: message
    }
  }
}

/**
 * Post to Twitter
 */
export async function postToTwitter(text: string, imageUrl?: string): Promise<ComposioPostResult> {
  const params: Record<string, unknown> = { text }
  if (imageUrl) {
    params.media_url = imageUrl
  }
  return executePost('twitter', params)
}

/**
 * Post to LinkedIn
 */
export async function postToLinkedIn(text: string, imageUrl?: string): Promise<ComposioPostResult> {
  const params: Record<string, unknown> = { text }
  if (imageUrl) {
    params.image_url = imageUrl
  }
  return executePost('linkedin', params)
}

/**
 * Post to Instagram (requires Business/Creator account)
 */
export async function postToInstagram(text: string, imageUrl: string): Promise<ComposioPostResult> {
  if (!imageUrl) {
    return {
      platform: 'instagram',
      success: false,
      error: 'Instagram requires an image'
    }
  }

  return executePost('instagram', {
    caption: text,
    image_url: imageUrl
  })
}

/**
 * Post to Facebook Page
 */
export async function postToFacebook(text: string, imageUrl?: string): Promise<ComposioPostResult> {
  const params: Record<string, unknown> = { message: text }
  if (imageUrl) {
    params.url = imageUrl
  }
  return executePost('facebook', params)
}

/**
 * Post to all specified platforms
 */
export async function postToAll(
  content: {
    twitter?: { text: string; hashtags: string[] }
    linkedin?: { text: string; hashtags: string[] }
    instagram?: { text: string; hashtags: string[] }
    facebook?: { text: string; hashtags: string[] }
  },
  imageUrl?: string,
  platforms: Platform[] = ['twitter', 'linkedin']
): Promise<ComposioPostResult[]> {
  const results: ComposioPostResult[] = []

  for (const platform of platforms) {
    const platformContent = content[platform]
    if (!platformContent) {
      results.push({
        platform,
        success: false,
        error: `No content for ${platform}`
      })
      continue
    }

    const text = `${platformContent.text}\n\n${platformContent.hashtags.map(h => `#${h}`).join(' ')}`

    switch (platform) {
      case 'twitter':
        results.push(await postToTwitter(text, imageUrl))
        break
      case 'linkedin':
        results.push(await postToLinkedIn(text, imageUrl))
        break
      case 'instagram':
        results.push(await postToInstagram(text, imageUrl || ''))
        break
      case 'facebook':
        results.push(await postToFacebook(text, imageUrl))
        break
    }
  }

  return results
}

/**
 * Get connection status for all platforms
 */
export async function getConnectionStatus(
  platforms: Platform[] = ['twitter', 'linkedin', 'instagram', 'facebook']
): Promise<ComposioAuthResult[]> {
  const results: ComposioAuthResult[] = []

  for (const platform of platforms) {
    results.push(await checkConnection(platform))
  }

  return results
}
