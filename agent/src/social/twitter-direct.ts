/**
 * Direct Twitter API integration with OAuth 1.0a for media upload
 * Supports multiple brand accounts
 */

import crypto from 'crypto'

export type TwitterBrand = 'scty' | 'givecare'

interface TwitterCredentials {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

interface PostResult {
  success: boolean
  tweetId?: string
  tweetUrl?: string
  error?: string
}

/**
 * Get credentials for a brand (supports per-brand API keys)
 */
function getCredentials(brand: TwitterBrand): TwitterCredentials {
  const brandUpper = brand.toUpperCase()

  // Try brand-specific API keys first, fall back to shared
  const apiKey = process.env[`TWITTER_${brandUpper}_API_KEY`] || process.env.TWITTER_API_KEY
  const apiSecret = process.env[`TWITTER_${brandUpper}_API_SECRET`] || process.env.TWITTER_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(`TWITTER_${brandUpper}_API_KEY/SECRET or TWITTER_API_KEY/SECRET required`)
  }

  const accessToken = process.env[`TWITTER_${brandUpper}_ACCESS_TOKEN`]
  const accessSecret = process.env[`TWITTER_${brandUpper}_ACCESS_SECRET`]

  if (!accessToken || !accessSecret) {
    throw new Error(`TWITTER_${brandUpper}_ACCESS_TOKEN and TWITTER_${brandUpper}_ACCESS_SECRET required`)
  }

  return { apiKey, apiSecret, accessToken, accessSecret }
}

/**
 * Generate OAuth 1.0a signature
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  creds: TwitterCredentials
): string {
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(params)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&')
    )
  ].join('&')

  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessSecret)}`

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64')
}

/**
 * Generate OAuth 1.0a header
 */
function generateOAuthHeader(
  method: string,
  url: string,
  creds: TwitterCredentials,
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0'
  }

  const allParams = { ...oauthParams, ...extraParams }
  const signature = generateOAuthSignature(method, url, allParams, creds)
  oauthParams.oauth_signature = signature

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}

/**
 * Upload media to Twitter (v1.1 API with OAuth 1.0a)
 * Returns media_id_string
 */
async function uploadMedia(
  imageData: Buffer,
  mimeType: string,
  creds: TwitterCredentials
): Promise<string> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json'

  // Use multipart/form-data for media upload
  const formData = new FormData()
  const extension = mimeType.includes('png') ? 'png' : 'jpg'
  formData.append('media', new Blob([imageData], { type: mimeType }), `image.${extension}`)

  // Don't include body params in OAuth signature for multipart
  const authHeader = generateOAuthHeader('POST', url, creds)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader
    },
    body: formData
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Media upload failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.media_id_string
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<{ data: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/png'
  const arrayBuffer = await response.arrayBuffer()

  return {
    data: Buffer.from(arrayBuffer),
    mimeType: contentType
  }
}

/**
 * Create tweet with optional media (v2 API with OAuth 1.0a)
 */
async function createTweet(
  text: string,
  mediaIds: string[],
  creds: TwitterCredentials
): Promise<{ id: string; text: string }> {
  const url = 'https://api.twitter.com/2/tweets'

  const body: Record<string, unknown> = { text }
  if (mediaIds.length > 0) {
    body.media = { media_ids: mediaIds }
  }

  const authHeader = generateOAuthHeader('POST', url, creds)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tweet creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.data
}

/**
 * Post to Twitter with text and optional image
 */
export async function postToTwitter(
  brand: TwitterBrand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  try {
    const creds = getCredentials(brand)
    const mediaIds: string[] = []

    // Upload image if provided
    if (imageUrl) {
      console.log(`[twitter-direct] Downloading image for ${brand}...`)
      const { data, mimeType } = await downloadImage(imageUrl)

      console.log(`[twitter-direct] Uploading media (${(data.length / 1024).toFixed(1)}KB)...`)
      const mediaId = await uploadMedia(data, mimeType, creds)
      mediaIds.push(mediaId)
      console.log(`[twitter-direct] Media uploaded: ${mediaId}`)
    }

    // Create tweet
    console.log(`[twitter-direct] Creating tweet for ${brand}...`)
    const tweet = await createTweet(text, mediaIds, creds)

    const tweetUrl = `https://x.com/i/status/${tweet.id}`
    console.log(`[twitter-direct] Tweet posted: ${tweetUrl}`)

    return {
      success: true,
      tweetId: tweet.id,
      tweetUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[twitter-direct] Error posting for ${brand}:`, message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Check if credentials are configured for a brand
 */
export function hasCredentials(brand: TwitterBrand): boolean {
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
export function getConfiguredBrands(): TwitterBrand[] {
  const brands: TwitterBrand[] = []
  if (hasCredentials('scty')) brands.push('scty')
  if (hasCredentials('givecare')) brands.push('givecare')
  return brands
}
