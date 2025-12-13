/**
 * API functions - wraps server functions for use in components
 */

import { generateContentFn, publishContentFn, refineCopyFn, refineImageFn, generateVideoFn, uploadYouTubeShortFn } from './server/generate'
import { schedulePostFn, getScheduledPostsFn, cancelScheduledPostFn, type ScheduledPost } from './server/scheduler'
import { listBrandsFn, getBrandFn, type BrandSummary, type BrandDetail } from './server/brands'
import type { GenerationResult } from './server/types'

export type { GenerationResult, PlatformContent } from './server/types'
export type { BrandSummary, BrandDetail } from './server/brands'

export interface PublishResult {
  platform: string
  success: boolean
  postUrl: string
  dryRun?: boolean
  error?: string
  needsAuth?: boolean
  authUrl?: string
}

/**
 * Generate image + copy for a topic
 */
export async function generateContent(topic: string, brand: string = 'givecare'): Promise<GenerationResult> {
  return generateContentFn({ data: { topic, brand } })
}

/**
 * Publish content to social platforms
 */
export async function publishContent(
  generationId: string,
  platforms: string[] = ['twitter', 'linkedin'],
  brand: string = 'givecare'
): Promise<{ generationId: string; results: PublishResult[]; dryRun: boolean }> {
  return publishContentFn({ data: { generationId, platforms, brand } })
}

/**
 * Get available brands
 */
export async function listBrands(): Promise<BrandSummary[]> {
  return listBrandsFn()
}

/**
 * Get brand details
 */
export async function getBrand(id: string): Promise<BrandDetail | null> {
  return getBrandFn({ data: { id } })
}

/**
 * Refine copy from source content
 */
export async function refineCopy(sourceContent: string, brand: string) {
  return refineCopyFn({ data: { sourceContent, brand } })
}

/**
 * Refine image from prompt
 */
export async function refineImage(imagePrompt: string, brand: string) {
  return refineImageFn({ data: { imagePrompt, brand } })
}

/**
 * Generate video from image for YouTube Shorts
 */
export async function generateVideo(
  imageUrl: string,
  brand: string,
  motionIntensity: 'low' | 'medium' | 'high' = 'medium'
): Promise<{ videoUrl: string; videoPath?: string; model: string; duration?: number }> {
  return generateVideoFn({ data: { imageUrl, brand, motionIntensity } })
}

/**
 * Upload video to YouTube as Short
 */
export async function uploadYouTubeShort(
  videoPath: string,
  title: string,
  description: string,
  brand: string,
  options: { tags?: string[]; privacyStatus?: 'public' | 'private' | 'unlisted' } = {}
): Promise<{ success: boolean; videoId?: string; videoUrl?: string }> {
  return uploadYouTubeShortFn({
    data: {
      videoPath,
      title,
      description,
      brand,
      tags: options.tags,
      privacyStatus: options.privacyStatus
    }
  })
}

/**
 * Schedule a post for future publishing
 */
export async function schedulePost(
  generationId: string,
  brand: string,
  platforms: string[],
  scheduledFor: Date
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  return schedulePostFn({
    data: {
      generationId,
      brand,
      platforms,
      scheduledFor: scheduledFor.toISOString()
    }
  })
}

/**
 * Get all scheduled posts
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  return getScheduledPostsFn()
}

/**
 * Cancel a scheduled post
 */
export async function cancelScheduledPost(
  scheduleId: string
): Promise<{ success: boolean; error?: string }> {
  return cancelScheduledPostFn({ data: { scheduleId } })
}

export type { ScheduledPost }
