/**
 * Unified Meta Graph API adapter for Instagram + Threads
 * Shares: container creation, status polling, publish flow
 * Differences: base URL, media endpoints, status field name, permalink resolution
 */

import { loadBrand } from '../core/brand'
import type { Brand } from '../core/types'
import {
  createCredentialGetter,
  createHasCredentials,
  createGetConfiguredBrands,
  type PostResult
} from './base'

export type MetaPlatform = 'instagram' | 'threads'

// --- Platform-specific config ---

interface PlatformConfig {
  baseUrl: string
  apiVersion: string
  /** Container creation endpoint suffix (appended to userId) */
  containerEndpoint: string
  /** Publish endpoint suffix (appended to userId) */
  publishEndpoint: string
  /** Field name returned by status check */
  statusField: string
  /** Env var prefix for credentials */
  envPrefix: string
  label: string
}

const PLATFORM_CONFIG: Record<MetaPlatform, PlatformConfig> = {
  instagram: {
    baseUrl: 'https://graph.instagram.com',
    apiVersion: 'v21.0',
    containerEndpoint: 'media',
    publishEndpoint: 'media_publish',
    statusField: 'status_code',
    envPrefix: 'INSTAGRAM',
    label: 'instagram'
  },
  threads: {
    baseUrl: 'https://graph.threads.net',
    apiVersion: 'v1.0',
    containerEndpoint: 'threads',
    publishEndpoint: 'threads_publish',
    statusField: 'status',
    envPrefix: 'THREADS',
    label: 'threads'
  }
}

// --- Credentials ---

interface MetaCredentials {
  accessToken: string
  userId: string
}

const getInstagramCredentials = createCredentialGetter<MetaCredentials>('INSTAGRAM', [
  { suffix: 'ACCESS_TOKEN', field: 'accessToken', errorHint: 'Run: npx tsx instagram-auth.ts' },
  { suffix: 'USER_ID', field: 'userId' }
])

const getThreadsCredentials = createCredentialGetter<MetaCredentials>('THREADS', [
  { suffix: 'ACCESS_TOKEN', field: 'accessToken', errorHint: 'Run: npx tsx threads-auth.ts' },
  { suffix: 'USER_ID', field: 'userId' }
])

function getCredentials(platform: MetaPlatform, brand: Brand): MetaCredentials {
  return platform === 'instagram'
    ? getInstagramCredentials(brand)
    : getThreadsCredentials(brand)
}

// --- Shared Graph API helpers ---

function buildUrl(cfg: PlatformConfig, path: string, params?: URLSearchParams): string {
  const qs = params ? `?${params}` : ''
  return `${cfg.baseUrl}/${cfg.apiVersion}/${path}${qs}`
}

/**
 * Create a media container (image or text-only for Threads)
 */
async function createContainer(
  cfg: PlatformConfig,
  creds: MetaCredentials,
  text: string,
  imageUrl?: string
): Promise<string> {
  const params: Record<string, string> = {
    access_token: creds.accessToken
  }

  if (cfg.envPrefix === 'INSTAGRAM') {
    // Instagram: always image, caption param
    if (!imageUrl) throw new Error('Instagram requires an image')
    params.image_url = imageUrl
    params.caption = text
  } else {
    // Threads: text or image
    params.text = text
    if (imageUrl) {
      params.media_type = 'IMAGE'
      params.image_url = imageUrl
    } else {
      params.media_type = 'TEXT'
    }
  }

  const endpoint = `${creds.userId}/${cfg.containerEndpoint}`
  const url = buildUrl(cfg, endpoint)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Container creation failed: ${response.status} ${body}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Poll container status until FINISHED or timeout
 */
async function waitForContainer(
  cfg: PlatformConfig,
  containerId: string,
  accessToken: string,
  maxIterations: number = 60
): Promise<void> {
  const pollIntervalMs = 500

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    const params = new URLSearchParams({
      fields: cfg.statusField,
      access_token: accessToken
    })

    const response = await fetch(buildUrl(cfg, containerId, params))

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`)
    }

    const data = await response.json()

    if (!(cfg.statusField in data)) {
      throw new Error(`API response missing status field: ${cfg.statusField}`)
    }

    const status = data[cfg.statusField]
    console.log(`[meta-graph] Poll ${attempt}/${maxIterations} — status: ${status}`)

    if (status === 'FINISHED') return
    if (status === 'ERROR') throw new Error('Container processing failed')

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`Container processing timed out after ${maxIterations} polls`)
}

/**
 * Publish a ready container
 */
async function publishContainer(
  cfg: PlatformConfig,
  creds: MetaCredentials,
  containerId: string
): Promise<{ id: string }> {
  const endpoint = `${creds.userId}/${cfg.publishEndpoint}`
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: creds.accessToken
  })

  const response = await fetch(buildUrl(cfg, endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Publish failed: ${response.status} ${body}`)
  }

  return response.json()
}

// --- Permalink resolution ---

async function getInstagramPermalink(mediaId: string, accessToken: string): Promise<string> {
  const params = new URLSearchParams({ fields: 'permalink', access_token: accessToken })
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${mediaId}?${params}`
  )
  if (!response.ok) return `https://www.instagram.com/p/${mediaId}/`
  const data = await response.json()
  return data.permalink || `https://www.instagram.com/p/${mediaId}/`
}

function getThreadsPostUrl(brand: Brand, postId: string): string {
  let handle = brand
  try {
    const brandConfig = loadBrand(brand)
    if (brandConfig.handles?.threads) {
      handle = brandConfig.handles.threads.replace('@', '')
    }
  } catch {
    // fallback to brand name
  }
  return `https://www.threads.net/@${handle}/post/${postId}`
}

// --- Public API ---

/**
 * Post to Instagram or Threads via Meta Graph API
 */
export async function postToMetaGraph(
  platform: MetaPlatform,
  brand: Brand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  const cfg = PLATFORM_CONFIG[platform]
  const tag = `[${cfg.label}]`

  try {
    const creds = getCredentials(platform, brand)

    // Instagram requires image; Threads validates URL only when provided
    if (platform === 'instagram' && !imageUrl) {
      throw new Error('Instagram requires a publicly accessible image URL')
    }
    if (imageUrl && !imageUrl.startsWith('http')) {
      throw new Error(`${cfg.label} requires a publicly accessible image URL`)
    }

    console.log(`${tag} Creating container for ${brand}...`)
    const containerId = await createContainer(cfg, creds, text, imageUrl)
    console.log(`${tag} Container created: ${containerId}`)

    console.log(`${tag} Waiting for processing...`)
    await waitForContainer(cfg, containerId, creds.accessToken)

    console.log(`${tag} Publishing...`)
    const post = await publishContainer(cfg, creds, containerId)

    // Resolve permalink
    let postUrl: string
    if (platform === 'instagram') {
      console.log(`${tag} Fetching permalink...`)
      postUrl = await getInstagramPermalink(post.id, creds.accessToken)
    } else {
      postUrl = getThreadsPostUrl(brand, post.id)
    }

    console.log(`${tag} Post created: ${post.id}`)

    return { success: true, postId: post.id, postUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`${tag} Error posting for ${brand}:`, message)
    return { success: false, error: message }
  }
}

/**
 * Post to Instagram (convenience wrapper preserving original API)
 */
export async function postToInstagram(
  brand: Brand,
  caption: string,
  imageUrl: string
): Promise<PostResult> {
  return postToMetaGraph('instagram', brand, caption, imageUrl)
}

/**
 * Post to Threads (convenience wrapper preserving original API)
 */
export async function postToThreads(
  brand: Brand,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  return postToMetaGraph('threads', brand, text, imageUrl)
}

// --- Credential checks ---

export const hasInstagramCredentials = createHasCredentials(getInstagramCredentials)
export const hasThreadsCredentials = createHasCredentials(getThreadsCredentials)

export const getConfiguredInstagramBrands = createGetConfiguredBrands(hasInstagramCredentials)
export const getConfiguredThreadsBrands = createGetConfiguredBrands(hasThreadsCredentials)
