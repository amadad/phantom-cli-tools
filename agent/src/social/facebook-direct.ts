/**
 * Direct Facebook Pages API integration
 * Uses Graph API v21.0 with Page Access Tokens
 */

export type FacebookBrand = 'scty' | 'givecare'

interface FacebookCredentials {
  pageAccessToken: string
  pageId: string
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
function getCredentials(brand: FacebookBrand): FacebookCredentials {
  const brandUpper = brand.toUpperCase()

  const pageAccessToken = process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`]
  const pageId = process.env[`FACEBOOK_${brandUpper}_PAGE_ID`]

  if (!pageAccessToken) {
    throw new Error(`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN not set. Run: npx tsx facebook-auth.ts`)
  }

  if (!pageId) {
    throw new Error(`FACEBOOK_${brandUpper}_PAGE_ID not set`)
  }

  return { pageAccessToken, pageId }
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Upload and publish a photo to Facebook in one step
 */
async function uploadAndPublishPhoto(
  imageData: Buffer,
  message: string,
  creds: FacebookCredentials
): Promise<{ id: string; post_id: string }> {
  const formData = new FormData()
  formData.append('source', new Blob([imageData], { type: 'image/jpeg' }), 'image.jpg')
  formData.append('message', message)
  formData.append('published', 'true') // Publish immediately
  formData.append('access_token', creds.pageAccessToken)

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${creds.pageId}/photos`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Photo upload failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data
}

/**
 * Create a text-only post on a Facebook Page
 */
async function createTextPost(
  text: string,
  creds: FacebookCredentials
): Promise<{ id: string }> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${creds.pageId}/feed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        access_token: creds.pageAccessToken
      })
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Post creation failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Create a post with photo on a Facebook Page
 */
async function createPhotoPost(
  text: string,
  photoId: string,
  creds: FacebookCredentials
): Promise<{ id: string }> {
  // Publish the photo with a message
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${photoId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        published: true,
        access_token: creds.pageAccessToken
      })
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Photo post failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Post to Facebook Page with text and optional image
 */
export async function postToFacebook(
  brand: FacebookBrand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  try {
    const creds = getCredentials(brand)
    let post: { id: string }

    if (imageUrl) {
      // Post with image - upload and publish in one step
      console.log(`[facebook-direct] Downloading image for ${brand}...`)
      const imageData = await downloadImage(imageUrl)

      console.log(`[facebook-direct] Uploading and publishing photo (${(imageData.length / 1024).toFixed(1)}KB)...`)
      const result = await uploadAndPublishPhoto(imageData, text, creds)
      console.log(`[facebook-direct] Photo published: ${result.id}`)
      post = { id: result.post_id || result.id }
    } else {
      // Text-only post
      console.log(`[facebook-direct] Creating text post for ${brand}...`)
      post = await createTextPost(text, creds)
    }

    // Build post URL
    const postUrl = `https://www.facebook.com/${post.id}`
    console.log(`[facebook-direct] Post created: ${postUrl}`)

    return {
      success: true,
      postId: post.id,
      postUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[facebook-direct] Error posting for ${brand}:`, message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Check if credentials are configured for a brand
 */
export function hasCredentials(brand: FacebookBrand): boolean {
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
export function getConfiguredBrands(): FacebookBrand[] {
  const brands: FacebookBrand[] = []
  if (hasCredentials('scty')) brands.push('scty')
  if (hasCredentials('givecare')) brands.push('givecare')
  return brands
}
