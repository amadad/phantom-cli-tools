/**
 * Direct Threads API integration
 * Uses Threads Graph API for publishing
 */

import { loadBrand } from '../core/brand'
import type { Brand } from '../core/types'
import {
  createCredentialGetter,
  createHasCredentials,
  createGetConfiguredBrands,
  type PostResult
} from './base'

export type ThreadsBrand = Brand

interface ThreadsCredentials {
  accessToken: string
  userId: string
}

const getCredentials = createCredentialGetter<ThreadsCredentials>('THREADS', [
  { suffix: 'ACCESS_TOKEN', field: 'accessToken', errorHint: 'Run: npx tsx threads-auth.ts' },
  { suffix: 'USER_ID', field: 'userId' }
])

/**
 * Create a text-only thread container
 */
async function createTextContainer(
  text: string,
  creds: ThreadsCredentials
): Promise<string> {
  const params = new URLSearchParams({
    text,
    media_type: 'TEXT',
    access_token: creds.accessToken
  })

  const response = await fetch(
    `https://graph.threads.net/v1.0/${creds.userId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Container creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Create an image thread container
 * Note: image_url must be a publicly accessible URL
 */
async function createImageContainer(
  text: string,
  imageUrl: string,
  creds: ThreadsCredentials
): Promise<string> {
  const params = new URLSearchParams({
    text,
    media_type: 'IMAGE',
    image_url: imageUrl,
    access_token: creds.accessToken
  })

  const response = await fetch(
    `https://graph.threads.net/v1.0/${creds.userId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Container creation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Check container status
 */
async function checkContainerStatus(
  containerId: string,
  accessToken: string
): Promise<'FINISHED' | 'IN_PROGRESS' | 'ERROR'> {
  const params = new URLSearchParams({
    fields: 'status',
    access_token: accessToken
  })

  const response = await fetch(
    `https://graph.threads.net/v1.0/${containerId}?${params}`
  )

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`)
  }

  const data = await response.json()
  return data.status
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
 * Publish a thread container
 */
async function publishContainer(
  containerId: string,
  creds: ThreadsCredentials
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: creds.accessToken
  })

  const response = await fetch(
    `https://graph.threads.net/v1.0/${creds.userId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Publish failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Post to Threads with text and optional image
 */
export async function postToThreads(
  brand: ThreadsBrand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  try {
    const creds = getCredentials(brand)
    let containerId: string

    if (imageUrl) {
      // Validate image URL
      if (!imageUrl.startsWith('http')) {
        throw new Error('Threads requires a publicly accessible image URL')
      }

      console.log(`[threads-direct] Creating image container for ${brand}...`)
      containerId = await createImageContainer(text, imageUrl, creds)
    } else {
      console.log(`[threads-direct] Creating text container for ${brand}...`)
      containerId = await createTextContainer(text, creds)
    }

    console.log(`[threads-direct] Container created: ${containerId}`)

    console.log(`[threads-direct] Waiting for processing...`)
    await waitForContainer(containerId, creds.accessToken)

    console.log(`[threads-direct] Publishing...`)
    const post = await publishContainer(containerId, creds)

    // Get actual Threads handle from brand config, fallback to brand name
    let threadsHandle = brand
    try {
      const brandConfig = loadBrand(brand)
      if (brandConfig.handles?.threads) {
        threadsHandle = brandConfig.handles.threads.replace('@', '')
      }
    } catch {
      // Use brand name as fallback
    }

    const postUrl = `https://www.threads.net/@${threadsHandle}/post/${post.id}`
    console.log(`[threads-direct] Post created: ${post.id}`)

    return {
      success: true,
      postId: post.id,
      postUrl
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[threads-direct] Error posting for ${brand}:`, message)
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
