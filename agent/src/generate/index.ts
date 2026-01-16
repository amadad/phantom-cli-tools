/**
 * generate: Content generation
 */

export { generateCopy } from './copy'
export type { CopyResult, PlatformCopy } from './copy'

export { classify } from './classify'
export type { ContentType, ImageType } from './classify'

// Note: image.ts generates raw images via Gemini
// For composited posters, see composite/
