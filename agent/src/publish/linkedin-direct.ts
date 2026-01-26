/**
 * Direct LinkedIn API integration for company page posting
 * Uses v2 API with OAuth 2.0 access tokens
 */

import { downloadImage } from '../core/http'
import type { Brand } from '../core/types'
import {
  createCredentialGetter,
  createHasCredentials,
  createGetConfiguredBrands,
  type PostResult
} from './base'

export type LinkedInBrand = Brand

interface LinkedInCredentials {
  accessToken: string
  orgId: string
}

const getCredentials = createCredentialGetter<LinkedInCredentials>('LINKEDIN', [
  { suffix: 'ACCESS_TOKEN', field: 'accessToken', errorHint: 'Run: npx tsx linkedin-auth.ts' },
  { suffix: 'ORG_ID', field: 'orgId' }
])


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
    body: new Uint8Array(imageData)
  })

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text()
    throw new Error(`Image upload failed: ${uploadResponse.status} ${text}`)
  }

  return asset
}

/**
 * Create a post on a company page (with optional image)
 */
async function createPost(
  text: string,
  creds: LinkedInCredentials,
  imageAsset?: string
): Promise<{ id: string }> {
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text },
    shareMediaCategory: imageAsset ? 'IMAGE' : 'NONE'
  }

  if (imageAsset) {
    shareContent.media = [{ status: 'READY', media: imageAsset }]
  }

  const postBody = {
    author: `urn:li:organization:${creds.orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
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
    const errText = await response.text()
    throw new Error(`Post creation failed: ${response.status} ${errText}`)
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

    let imageAsset: string | undefined
    if (imageUrl) {
      console.log(`[linkedin-direct] Downloading image for ${brand}...`)
      const { data: imageData } = await downloadImage(imageUrl)

      console.log(`[linkedin-direct] Uploading media (${(imageData.length / 1024).toFixed(1)}KB)...`)
      imageAsset = await uploadImage(imageData, creds)
      console.log(`[linkedin-direct] Media uploaded: ${imageAsset}`)
    }

    console.log(`[linkedin-direct] Creating ${imageAsset ? 'image' : 'text'} post for ${brand}...`)
    post = await createPost(text, creds, imageAsset)

    // Build post URL - ugcPosts returns urn:li:ugcPost:ID format
    // LinkedIn accepts the full URN in the URL
    const postUrl = `https://www.linkedin.com/feed/update/${post.id}`
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

/** Check if credentials are configured for a brand */
export const hasCredentials = createHasCredentials(getCredentials)

/** Get configured brands */
export const getConfiguredBrands = createGetConfiguredBrands(hasCredentials)
