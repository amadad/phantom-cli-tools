/**
 * Base utilities for platform publishing
 * Provides common patterns for credential management and brand discovery
 */

import { discoverBrands } from '../core/paths'
import type { Brand } from '../core/types'

export interface PostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Create a credential getter for a platform
 *
 * @param platform - Platform name (TWITTER, LINKEDIN, etc.)
 * @param requiredFields - Array of field configs with env suffix and error message
 */
export function createCredentialGetter<T>(
  platform: string,
  requiredFields: Array<{ suffix: string; field: keyof T; errorHint?: string }>
): (brand: Brand) => T {
  return (brand: Brand): T => {
    const brandUpper = brand.toUpperCase()
    const result = {} as T

    for (const { suffix, field, errorHint } of requiredFields) {
      const value = process.env[`${platform}_${brandUpper}_${suffix}`]
      if (!value) {
        const hint = errorHint ? `. ${errorHint}` : ''
        throw new Error(`${platform}_${brandUpper}_${suffix} not set${hint}`)
      }
      result[field] = value as T[keyof T]
    }

    return result
  }
}

/**
 * Create hasCredentials checker from a credential getter
 */
export function createHasCredentials<T>(
  getCredentials: (brand: Brand) => T
): (brand: Brand) => boolean {
  return (brand: Brand): boolean => {
    try {
      getCredentials(brand)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Create getConfiguredBrands function from hasCredentials
 */
export function createGetConfiguredBrands(
  hasCredentials: (brand: Brand) => boolean
): () => Brand[] {
  return (): Brand[] => {
    return discoverBrands().filter(brand => hasCredentials(brand))
  }
}

/**
 * Wrap a post function with standard error handling
 */
export function withErrorHandling(
  platformName: string,
  fn: (brand: Brand, text: string, imageUrl?: string) => Promise<PostResult>
): (brand: Brand, text: string, imageUrl?: string) => Promise<PostResult> {
  return async (brand: Brand, text: string, imageUrl?: string): Promise<PostResult> => {
    try {
      return await fn(brand, text, imageUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[${platformName}] Error posting for ${brand}:`, message)
      return { success: false, error: message }
    }
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  }
  return extensions[mimeType] || 'jpg'
}
