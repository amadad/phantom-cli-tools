/**
 * Direct Instagram API integration
 * Uses Instagram Graph API via Facebook (requires Business/Creator account)
 * Note: Instagram API requires images to be publicly accessible URLs
 */

export type InstagramBrand = 'scty' | 'givecare'

interface InstagramCredentials {
  accessToken: string  // Facebook Page Access Token with instagram permissions
  igUserId: string     // Instagram Business Account ID
}

interface PostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Get credentials for a brand
 */
function getCredentials(brand: InstagramBrand): InstagramCredentials {
  const brandUpper = brand.toUpperCase()

  // Try Instagram Platform API token first, fall back to Facebook Page token
  const accessToken = process.env[`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`]
    || process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`]
  const igUserId = process.env[`INSTAGRAM_${brandUpper}_USER_ID`]

  if (!accessToken) {
    throw new Error(`INSTAGRAM_${brandUpper}_ACCESS_TOKEN not set. Run: npx tsx instagram-auth.ts`)
  }

  if (!igUserId) {
    throw new Error(`INSTAGRAM_${brandUpper}_USER_ID not set`)
  }

  return { accessToken, igUserId }
}

/**
 * Create a media container for an image post
 * Note: image_url must be a publicly accessible URL
 */
async function createMediaContainer(
  imageUrl: string,
  caption: string,
  creds: InstagramCredentials
): Promise<string> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: creds.accessToken
  })

  // Use graph.instagram.com for Instagram Platform API
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${creds.igUserId}/media?${params}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Container creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Check container status (Instagram processes async)
 */
async function checkContainerStatus(
  containerId: string,
  accessToken: string
): Promise<'FINISHED' | 'IN_PROGRESS' | 'ERROR'> {
  const params = new URLSearchParams({
    fields: 'status_code',
    access_token: accessToken
  })

  const response = await fetch(
    `https://graph.instagram.com/v21.0/${containerId}?${params}`
  )

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`)
  }

  const data = await response.json()
  return data.status_code
}

/**
 * Wait for container to be ready
 */
async function waitForContainer(
  containerId: string,
  accessToken: string,
  maxWaitMs: number = 30000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkContainerStatus(containerId, accessToken)

    if (status === 'FINISHED') {
      return
    }

    if (status === 'ERROR') {
      throw new Error('Container processing failed')
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  throw new Error('Container processing timed out')
}

/**
 * Publish a media container
 */
async function publishContainer(
  containerId: string,
  creds: InstagramCredentials
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: creds.accessToken
  })

  const response = await fetch(
    `https://graph.instagram.com/v21.0/${creds.igUserId}/media_publish?${params}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Publish failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Post to Instagram with image and caption
 * Note: Instagram requires an image - text-only posts are not supported
 * Note: imageUrl must be publicly accessible (not a data URL or local file)
 */
export async function postToInstagram(
  brand: InstagramBrand,
  caption: string,
  imageUrl: string
): Promise<PostResult> {
  try {
    const creds = getCredentials(brand)

    // Validate image URL
    if (!imageUrl.startsWith('http')) {
      throw new Error('Instagram requires a publicly accessible image URL (not data URLs)')
    }

    console.log(`[instagram-direct] Creating media container for ${brand}...`)
    const containerId = await createMediaContainer(imageUrl, caption, creds)
    console.log(`[instagram-direct] Container created: ${containerId}`)

    console.log(`[instagram-direct] Waiting for processing...`)
    await waitForContainer(containerId, creds.accessToken)

    console.log(`[instagram-direct] Publishing...`)
    const post = await publishContainer(containerId, creds)

    const postUrl = `https://www.instagram.com/p/${post.id}/`
    console.log(`[instagram-direct] Post created: ${post.id}`)

    return {
      success: true,
      postId: post.id,
      postUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[instagram-direct] Error posting for ${brand}:`, message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Check if credentials are configured for a brand
 */
export function hasCredentials(brand: InstagramBrand): boolean {
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
export function getConfiguredBrands(): InstagramBrand[] {
  const brands: InstagramBrand[] = []
  if (hasCredentials('scty')) brands.push('scty')
  if (hasCredentials('givecare')) brands.push('givecare')
  return brands
}
