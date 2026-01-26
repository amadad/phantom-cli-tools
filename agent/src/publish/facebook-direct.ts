/**
 * Direct Facebook Pages API integration
 * Uses Graph API v21.0 with Page Access Tokens
 */

import { downloadImage } from '../core/http'
import type { Brand } from '../core/types'
import {
  createCredentialGetter,
  createHasCredentials,
  createGetConfiguredBrands,
  getExtensionFromMime,
  type PostResult
} from './base'

export type FacebookBrand = Brand

interface FacebookCredentials {
  pageAccessToken: string
  pageId: string
}

const getCredentials = createCredentialGetter<FacebookCredentials>('FACEBOOK', [
  { suffix: 'PAGE_ACCESS_TOKEN', field: 'pageAccessToken', errorHint: 'Run: npx tsx facebook-auth.ts' },
  { suffix: 'PAGE_ID', field: 'pageId' }
])

/**
 * Upload and publish a photo to Facebook in one step
 */
async function uploadAndPublishPhoto(
  imageData: Buffer,
  message: string,
  mimeType: string,
  creds: FacebookCredentials
): Promise<{ id: string; post_id: string }> {
  const formData = new FormData()
  const extension = getExtensionFromMime(mimeType)
  formData.append('source', new Blob([new Uint8Array(imageData)], { type: mimeType }), `image.${extension}`)
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
      const { data: imageData, mimeType } = await downloadImage(imageUrl)

      console.log(`[facebook-direct] Uploading and publishing photo (${(imageData.length / 1024).toFixed(1)}KB, ${mimeType})...`)
      const result = await uploadAndPublishPhoto(imageData, text, mimeType, creds)
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

/** Check if credentials are configured for a brand */
export const hasCredentials = createHasCredentials(getCredentials)

/** Get configured brands */
export const getConfiguredBrands = createGetConfiguredBrands(hasCredentials)
