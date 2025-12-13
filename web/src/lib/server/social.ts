/**
 * Unified social posting module
 * Direct API integrations for all 6 platforms
 */

export type Brand = 'scty' | 'givecare'
export type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'youtube'

export interface PostResult {
  platform: Platform
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

// ============================================================================
// TWITTER (OAuth 1.0a)
// ============================================================================

interface TwitterCredentials {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

function getTwitterCredentials(brand: Brand): TwitterCredentials {
  const brandUpper = brand.toUpperCase()
  const apiKey = process.env[`TWITTER_${brandUpper}_API_KEY`]
  const apiSecret = process.env[`TWITTER_${brandUpper}_API_SECRET`]
  const accessToken = process.env[`TWITTER_${brandUpper}_ACCESS_TOKEN`]
  const accessSecret = process.env[`TWITTER_${brandUpper}_ACCESS_SECRET`]

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(`Twitter credentials not configured for ${brand}`)
  }

  return { apiKey, apiSecret, accessToken, accessSecret }
}

async function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  creds: TwitterCredentials
): Promise<string> {
  const crypto = await import('crypto')
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
  return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64')
}

async function generateOAuthHeader(
  method: string,
  url: string,
  creds: TwitterCredentials,
  extraParams: Record<string, string> = {}
): Promise<string> {
  const crypto = await import('crypto')
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0'
  }

  const allParams = { ...oauthParams, ...extraParams }
  oauthParams.oauth_signature = await generateOAuthSignature(method, url, allParams, creds)

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}

async function uploadTwitterMedia(imageData: Buffer, mimeType: string, creds: TwitterCredentials): Promise<string> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json'
  const formData = new FormData()
  const extension = mimeType.includes('png') ? 'png' : 'jpg'
  formData.append('media', new Blob([new Uint8Array(imageData)], { type: mimeType }), `image.${extension}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: await generateOAuthHeader('POST', url, creds) },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Twitter media upload failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.media_id_string
}

export async function postToTwitter(brand: Brand, text: string, imageUrl?: string): Promise<PostResult> {
  try {
    const creds = getTwitterCredentials(brand)
    const mediaIds: string[] = []

    if (imageUrl) {
      const { data, mimeType } = await downloadImage(imageUrl)
      const mediaId = await uploadTwitterMedia(data, mimeType, creds)
      mediaIds.push(mediaId)
    }

    const url = 'https://api.twitter.com/2/tweets'
    const body: Record<string, unknown> = { text }
    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: await generateOAuthHeader('POST', url, creds),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Twitter post failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()
    return {
      platform: 'twitter',
      success: true,
      postId: data.data.id,
      postUrl: `https://x.com/i/status/${data.data.id}`
    }
  } catch (error) {
    return {
      platform: 'twitter',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// LINKEDIN (OAuth 2.0)
// ============================================================================

interface LinkedInCredentials {
  accessToken: string
  orgId: string
}

function getLinkedInCredentials(brand: Brand): LinkedInCredentials {
  const brandUpper = brand.toUpperCase()
  const accessToken = process.env[`LINKEDIN_${brandUpper}_ACCESS_TOKEN`]
  const orgId = process.env[`LINKEDIN_${brandUpper}_ORG_ID`]

  if (!accessToken || !orgId) {
    throw new Error(`LinkedIn credentials not configured for ${brand}`)
  }

  return { accessToken, orgId }
}

async function uploadLinkedInImage(imageData: Buffer, creds: LinkedInCredentials): Promise<string> {
  const registerBody = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: `urn:li:organization:${creds.orgId}`,
      serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
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
    throw new Error(`LinkedIn register failed: ${registerResponse.status}`)
  }

  const registerData = await registerResponse.json()
  const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
  const asset = registerData.value.asset

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${creds.accessToken}`, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(imageData)
  })

  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn upload failed: ${uploadResponse.status}`)
  }

  return asset
}

export async function postToLinkedIn(brand: Brand, text: string, imageUrl?: string): Promise<PostResult> {
  try {
    const creds = getLinkedInCredentials(brand)

    const postBody: Record<string, unknown> = {
      author: `urn:li:organization:${creds.orgId}`,
      lifecycleState: 'PUBLISHED',
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    }

    if (imageUrl) {
      const imageData = await downloadImage(imageUrl)
      const imageAsset = await uploadLinkedInImage(imageData.data, creds)
      postBody.specificContent = {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: imageAsset }]
        }
      }
    } else {
      postBody.specificContent = {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE'
        }
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
      throw new Error(`LinkedIn post failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()
    const shareId = data.id.replace('urn:li:share:', '')

    return {
      platform: 'linkedin',
      success: true,
      postId: data.id,
      postUrl: `https://www.linkedin.com/feed/update/urn:li:share:${shareId}`
    }
  } catch (error) {
    return {
      platform: 'linkedin',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// FACEBOOK (Graph API)
// ============================================================================

interface FacebookCredentials {
  pageAccessToken: string
  pageId: string
}

function getFacebookCredentials(brand: Brand): FacebookCredentials {
  const brandUpper = brand.toUpperCase()
  const pageAccessToken = process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`]
  const pageId = process.env[`FACEBOOK_${brandUpper}_PAGE_ID`]

  if (!pageAccessToken || !pageId) {
    throw new Error(`Facebook credentials not configured for ${brand}`)
  }

  return { pageAccessToken, pageId }
}

export async function postToFacebook(brand: Brand, text: string, imageUrl?: string): Promise<PostResult> {
  try {
    const creds = getFacebookCredentials(brand)

    if (imageUrl) {
      const imageData = await downloadImage(imageUrl)
      const formData = new FormData()
      formData.append('source', new Blob([new Uint8Array(imageData.data)], { type: 'image/jpeg' }), 'image.jpg')
      formData.append('message', text)
      formData.append('published', 'true')
      formData.append('access_token', creds.pageAccessToken)

      const response = await fetch(`https://graph.facebook.com/v21.0/${creds.pageId}/photos`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Facebook post failed: ${response.status} ${await response.text()}`)
      }

      const data = await response.json()
      return {
        platform: 'facebook',
        success: true,
        postId: data.post_id || data.id,
        postUrl: `https://www.facebook.com/${data.post_id || data.id}`
      }
    } else {
      const response = await fetch(`https://graph.facebook.com/v21.0/${creds.pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, access_token: creds.pageAccessToken })
      })

      if (!response.ok) {
        throw new Error(`Facebook post failed: ${response.status} ${await response.text()}`)
      }

      const data = await response.json()
      return {
        platform: 'facebook',
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${data.id}`
      }
    }
  } catch (error) {
    return {
      platform: 'facebook',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// INSTAGRAM (Platform API)
// ============================================================================

interface InstagramCredentials {
  accessToken: string
  igUserId: string
}

function getInstagramCredentials(brand: Brand): InstagramCredentials {
  const brandUpper = brand.toUpperCase()
  const accessToken = process.env[`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`] || process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`]
  const igUserId = process.env[`INSTAGRAM_${brandUpper}_USER_ID`]

  if (!accessToken || !igUserId) {
    throw new Error(`Instagram credentials not configured for ${brand}`)
  }

  return { accessToken, igUserId }
}

export async function postToInstagram(brand: Brand, caption: string, imageUrl: string): Promise<PostResult> {
  try {
    const creds = getInstagramCredentials(brand)

    if (!imageUrl.startsWith('http')) {
      throw new Error('Instagram requires a publicly accessible image URL')
    }

    // Create container
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: creds.accessToken
    })

    const containerResponse = await fetch(
      `https://graph.instagram.com/v21.0/${creds.igUserId}/media?${containerParams}`,
      { method: 'POST' }
    )

    if (!containerResponse.ok) {
      throw new Error(`Instagram container failed: ${containerResponse.status} ${await containerResponse.text()}`)
    }

    const containerData = await containerResponse.json()
    const containerId = containerData.id

    // Wait for processing
    let status = 'IN_PROGRESS'
    const maxWait = 30000
    const startTime = Date.now()

    while (status === 'IN_PROGRESS' && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 2000))
      const statusParams = new URLSearchParams({ fields: 'status_code', access_token: creds.accessToken })
      const statusResponse = await fetch(`https://graph.instagram.com/v21.0/${containerId}?${statusParams}`)
      const statusData = await statusResponse.json()
      status = statusData.status_code
    }

    if (status !== 'FINISHED') {
      throw new Error('Instagram processing timeout')
    }

    // Publish
    const publishParams = new URLSearchParams({ creation_id: containerId, access_token: creds.accessToken })
    const publishResponse = await fetch(
      `https://graph.instagram.com/v21.0/${creds.igUserId}/media_publish?${publishParams}`,
      { method: 'POST' }
    )

    if (!publishResponse.ok) {
      throw new Error(`Instagram publish failed: ${publishResponse.status}`)
    }

    const publishData = await publishResponse.json()
    return {
      platform: 'instagram',
      success: true,
      postId: publishData.id,
      postUrl: `https://www.instagram.com/p/${publishData.id}/`
    }
  } catch (error) {
    return {
      platform: 'instagram',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// THREADS (Threads API)
// ============================================================================

interface ThreadsCredentials {
  accessToken: string
  userId: string
}

function getThreadsCredentials(brand: Brand): ThreadsCredentials {
  const brandUpper = brand.toUpperCase()
  const accessToken = process.env[`THREADS_${brandUpper}_ACCESS_TOKEN`]
  const userId = process.env[`THREADS_${brandUpper}_USER_ID`]

  if (!accessToken || !userId) {
    throw new Error(`Threads credentials not configured for ${brand}`)
  }

  return { accessToken, userId }
}

export async function postToThreads(brand: Brand, text: string, imageUrl?: string): Promise<PostResult> {
  try {
    const creds = getThreadsCredentials(brand)

    // Create container
    const containerParams = new URLSearchParams({
      text,
      media_type: imageUrl ? 'IMAGE' : 'TEXT',
      access_token: creds.accessToken
    })

    if (imageUrl) {
      if (!imageUrl.startsWith('http')) {
        throw new Error('Threads requires a publicly accessible image URL')
      }
      containerParams.append('image_url', imageUrl)
    }

    const containerResponse = await fetch(
      `https://graph.threads.net/v1.0/${creds.userId}/threads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams
      }
    )

    if (!containerResponse.ok) {
      throw new Error(`Threads container failed: ${containerResponse.status} ${await containerResponse.text()}`)
    }

    const containerData = await containerResponse.json()
    const containerId = containerData.id

    // Wait for processing
    let status = 'IN_PROGRESS'
    const maxWait = 30000
    const startTime = Date.now()

    while (status === 'IN_PROGRESS' && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 2000))
      const statusParams = new URLSearchParams({ fields: 'status', access_token: creds.accessToken })
      const statusResponse = await fetch(`https://graph.threads.net/v1.0/${containerId}?${statusParams}`)
      const statusData = await statusResponse.json()
      status = statusData.status
    }

    if (status !== 'FINISHED') {
      throw new Error('Threads processing timeout')
    }

    // Publish
    const publishParams = new URLSearchParams({ creation_id: containerId, access_token: creds.accessToken })
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${creds.userId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: publishParams
      }
    )

    if (!publishResponse.ok) {
      throw new Error(`Threads publish failed: ${publishResponse.status}`)
    }

    const publishData = await publishResponse.json()
    return {
      platform: 'threads',
      success: true,
      postId: publishData.id,
      postUrl: `https://www.threads.net/@${brand}/post/${publishData.id}`
    }
  } catch (error) {
    return {
      platform: 'threads',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// YOUTUBE (Google OAuth - video only, handled separately)
// ============================================================================

export async function postToYouTube(
  brand: Brand,
  videoPath: string,
  title: string,
  description: string,
  options: { isShort?: boolean; tags?: string[]; privacyStatus?: 'public' | 'private' | 'unlisted' } = {}
): Promise<PostResult> {
  try {
    const brandUpper = brand.toUpperCase()
    const accessToken = process.env[`YOUTUBE_${brandUpper}_ACCESS_TOKEN`]
    const refreshToken = process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`]
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

    if (!accessToken || !refreshToken || !clientId || !clientSecret) {
      throw new Error(`YouTube credentials not configured for ${brand}`)
    }

    // Refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!tokenResponse.ok) {
      throw new Error(`YouTube token refresh failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const freshToken = tokenData.access_token

    // Read video file
    const fs = await import('fs/promises')
    const videoData = await fs.readFile(videoPath)

    // For Shorts, add #Shorts to title
    let finalTitle = title
    if (options.isShort && !title.includes('#Shorts')) {
      finalTitle = `${title} #Shorts`
    }

    const metadata = {
      snippet: {
        title: finalTitle,
        description,
        tags: options.tags || [],
        categoryId: '22'
      },
      status: {
        privacyStatus: options.privacyStatus || 'private',
        selfDeclaredMadeForKids: false
      }
    }

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
          'Authorization': `Bearer ${freshToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': body.length.toString()
        },
        body
      }
    )

    if (!response.ok) {
      throw new Error(`YouTube upload failed: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()
    const videoUrl = options.isShort
      ? `https://youtube.com/shorts/${data.id}`
      : `https://youtube.com/watch?v=${data.id}`

    return {
      platform: 'youtube',
      success: true,
      postId: data.id,
      postUrl: videoUrl
    }
  } catch (error) {
    return {
      platform: 'youtube',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

async function downloadImage(url: string): Promise<{ data: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || 'image/png'
  const arrayBuffer = await response.arrayBuffer()
  return { data: Buffer.from(arrayBuffer), mimeType: contentType }
}

// ============================================================================
// UNIFIED POST FUNCTION
// ============================================================================

export interface PostOptions {
  brand: Brand
  text: string
  imageUrl?: string
  platforms: Platform[]
  // For YouTube only
  videoPath?: string
  videoTitle?: string
  videoDescription?: string
  isShort?: boolean
}

export async function postToAll(options: PostOptions): Promise<PostResult[]> {
  const results: PostResult[] = []

  for (const platform of options.platforms) {
    console.log(`[social] Posting to ${platform} for ${options.brand}...`)

    let result: PostResult

    switch (platform) {
      case 'twitter':
        result = await postToTwitter(options.brand, options.text, options.imageUrl)
        break
      case 'linkedin':
        result = await postToLinkedIn(options.brand, options.text, options.imageUrl)
        break
      case 'facebook':
        result = await postToFacebook(options.brand, options.text, options.imageUrl)
        break
      case 'instagram':
        if (!options.imageUrl) {
          result = { platform: 'instagram', success: false, error: 'Instagram requires an image' }
        } else {
          result = await postToInstagram(options.brand, options.text, options.imageUrl)
        }
        break
      case 'threads':
        result = await postToThreads(options.brand, options.text, options.imageUrl)
        break
      case 'youtube':
        if (!options.videoPath) {
          result = { platform: 'youtube', success: false, error: 'YouTube requires a video file' }
        } else {
          result = await postToYouTube(
            options.brand,
            options.videoPath,
            options.videoTitle || 'Untitled',
            options.videoDescription || options.text,
            { isShort: options.isShort }
          )
        }
        break
      default:
        result = { platform, success: false, error: `Unknown platform: ${platform}` }
    }

    console.log(`[social] ${platform}: ${result.success ? 'success' : 'failed'} ${result.error || ''}`)
    results.push(result)
  }

  return results
}

/**
 * Check which platforms have credentials configured for a brand
 */
export function getConfiguredPlatforms(brand: Brand): Platform[] {
  const platforms: Platform[] = []
  const brandUpper = brand.toUpperCase()

  // Twitter
  if (process.env[`TWITTER_${brandUpper}_API_KEY`] && process.env[`TWITTER_${brandUpper}_ACCESS_TOKEN`]) {
    platforms.push('twitter')
  }

  // LinkedIn
  if (process.env[`LINKEDIN_${brandUpper}_ACCESS_TOKEN`] && process.env[`LINKEDIN_${brandUpper}_ORG_ID`]) {
    platforms.push('linkedin')
  }

  // Facebook
  if (process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`] && process.env[`FACEBOOK_${brandUpper}_PAGE_ID`]) {
    platforms.push('facebook')
  }

  // Instagram
  if (process.env[`INSTAGRAM_${brandUpper}_USER_ID`] &&
      (process.env[`INSTAGRAM_${brandUpper}_ACCESS_TOKEN`] || process.env[`FACEBOOK_${brandUpper}_PAGE_ACCESS_TOKEN`])) {
    platforms.push('instagram')
  }

  // Threads
  if (process.env[`THREADS_${brandUpper}_ACCESS_TOKEN`] && process.env[`THREADS_${brandUpper}_USER_ID`]) {
    platforms.push('threads')
  }

  // YouTube
  if (process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`] && process.env.YOUTUBE_CLIENT_ID) {
    platforms.push('youtube')
  }

  return platforms
}
