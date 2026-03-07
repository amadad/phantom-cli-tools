/**
 * Base utilities for platform publishing
 */

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
