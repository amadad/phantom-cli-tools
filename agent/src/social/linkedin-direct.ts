/**
 * Direct LinkedIn API integration for company page posting
 * Uses v2 API with OAuth 2.0 access tokens
 */

export type LinkedInBrand = 'scty' | 'givecare'

interface LinkedInCredentials {
  accessToken: string
  orgId: string
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
function getCredentials(brand: LinkedInBrand): LinkedInCredentials {
  const brandUpper = brand.toUpperCase()

  const accessToken = process.env[`LINKEDIN_${brandUpper}_ACCESS_TOKEN`]
  const orgId = process.env[`LINKEDIN_${brandUpper}_ORG_ID`]

  if (!accessToken) {
    throw new Error(`LINKEDIN_${brandUpper}_ACCESS_TOKEN not set. Run: npx tsx linkedin-auth.ts`)
  }

  if (!orgId) {
    throw new Error(`LINKEDIN_${brandUpper}_ORG_ID not set`)
  }

  return { accessToken, orgId }
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
 * Register and upload an image for use in a post
 * Uses v2/assets API
 */
async function uploadImage(
  imageData: Buffer,
  creds: LinkedInCredentials
): Promise<string> {
  // Step 1: Register upload
  const registerBody = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: `urn:li:organization:${creds.orgId}`,
      serviceRelationships: [
        {
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }
      ]
    }
  }

  const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(registerBody)
  })

  if (!registerResponse.ok) {
    const text = await registerResponse.text()
    throw new Error(`Image register failed: ${registerResponse.status} ${text}`)
  }

  const registerData = await registerResponse.json()
  const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
  const asset = registerData.value.asset

  // Step 2: Upload the image
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/octet-stream'
    },
    body: imageData
  })

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text()
    throw new Error(`Image upload failed: ${uploadResponse.status} ${text}`)
  }

  return asset
}

/**
 * Create a text-only post on a company page
 */
async function createTextPost(
  text: string,
  creds: LinkedInCredentials
): Promise<{ id: string }> {
  const postBody = {
    author: `urn:li:organization:${creds.orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postBody)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Post creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return { id: data.id }
}

/**
 * Create a post with image on a company page
 */
async function createImagePost(
  text: string,
  imageAsset: string,
  creds: LinkedInCredentials
): Promise<{ id: string }> {
  const postBody = {
    author: `urn:li:organization:${creds.orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            media: imageAsset
          }
        ]
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postBody)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Post creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return { id: data.id }
}

/**
 * Post to LinkedIn company page with text and optional image
 */
export async function postToLinkedIn(
  brand: LinkedInBrand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  try {
    const creds = getCredentials(brand)
    let post: { id: string }

    if (imageUrl) {
      // Post with image
      console.log(`[linkedin-direct] Downloading image for ${brand}...`)
      const imageData = await downloadImage(imageUrl)

      console.log(`[linkedin-direct] Uploading media (${(imageData.length / 1024).toFixed(1)}KB)...`)
      const imageAsset = await uploadImage(imageData, creds)
      console.log(`[linkedin-direct] Media uploaded: ${imageAsset}`)

      console.log(`[linkedin-direct] Creating post for ${brand}...`)
      post = await createImagePost(text, imageAsset, creds)
    } else {
      // Text-only post
      console.log(`[linkedin-direct] Creating text post for ${brand}...`)
      post = await createTextPost(text, creds)
    }

    // Extract share ID for URL
    const shareId = post.id.replace('urn:li:share:', '')
    const postUrl = `https://www.linkedin.com/feed/update/urn:li:share:${shareId}`
    console.log(`[linkedin-direct] Post created: ${postUrl}`)

    return {
      success: true,
      postId: post.id,
      postUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[linkedin-direct] Error posting for ${brand}:`, message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Check if credentials are configured for a brand
 */
export function hasCredentials(brand: LinkedInBrand): boolean {
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
export function getConfiguredBrands(): LinkedInBrand[] {
  const brands: LinkedInBrand[] = []
  if (hasCredentials('scty')) brands.push('scty')
  if (hasCredentials('givecare')) brands.push('givecare')
  return brands
}
