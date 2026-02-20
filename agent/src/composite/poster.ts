/**
 * Poster generation — thin wrapper around renderComposition.
 *
 * One renderer (BrandFrame via node-canvas). No Satori fallback.
 */

import { ASPECT_RATIOS, type AspectRatio, renderComposition } from './renderer/render'

interface PosterOptions {
  brand: string
  headline: string
  contentImage?: Buffer
  ratio?: AspectRatio
  logoPath?: string
  topic?: string
  /** Stable seed for reproducible layout/palette selection */
  seed?: string
}

/**
 * Generate a poster PNG for a given brand, headline, and optional image.
 */
export async function generatePoster(options: PosterOptions): Promise<Buffer> {
  const { brand, headline, contentImage, ratio = 'square', logoPath, topic, seed } = options

  const pngBuffer = await renderComposition({
    brand,
    headline,
    contentImage,
    ratio,
    logoPath,
    topic,
    seed,
  })

  return pngBuffer
}

// Re-export types — canonical source is render.ts
export type { AspectRatio } from './renderer/render'
export { ASPECT_RATIOS } from './renderer/render'
