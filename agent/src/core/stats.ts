/**
 * Statistical utilities for content analysis
 */

export interface PostWithViews {
  views?: number
  likes?: number
}

/**
 * Calculate median from array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Calculate median views from posts
 * Uses likes * multiplier as fallback when views not available
 *
 * @param posts - Array of posts with views and/or likes
 * @param likesMultiplier - Multiplier for likes→views estimation (Twitter ~50x, Instagram ~10x)
 */
export function calculateMedianViews(
  posts: PostWithViews[],
  likesMultiplier: number = 10
): number {
  if (posts.length === 0) return 0

  const views = posts.map(p => p.views || (p.likes || 0) * likesMultiplier)
  return calculateMedian(views)
}

/**
 * Platform-specific likes-to-views multiplier
 */
export function getLikesMultiplier(platform: string): number {
  switch (platform) {
    case 'twitter':
      return 50
    case 'instagram':
      return 10
    case 'tiktok':
      return 15
    case 'youtube':
      return 30
    default:
      return 10
  }
}
