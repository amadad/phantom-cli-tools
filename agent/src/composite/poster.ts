/**
 * Poster generation — thin wrapper around renderComposition.
 *
 * One renderer (BrandFrame via node-canvas). No Satori fallback.
 */

import { ASPECT_RATIOS, type AspectRatio, renderComposition } from './renderer/render'
import type { LayoutName } from '../core/visual'

interface PosterOptions {
  brand: string
  headline: string
  contentImage?: Buffer
  ratio?: AspectRatio
  noLogo?: boolean
  logoPath?: string
  /** Optional design profile key (typically mapped from --volume) */
  designZone?: string
  topic?: string
  /** Stable seed for reproducible layout/palette selection */
  seed?: string
  /** Force a specific layout (overrides deterministic selection) */
  layout?: LayoutName
}

/**
 * Generate a poster PNG for a given brand, headline, and optional image.
 */
export async function generatePoster(options: PosterOptions): Promise<Buffer> {
  const {
    brand,
    headline,
    contentImage,
    ratio = 'square',
    logoPath,
    noLogo,
    designZone,
    topic,
    seed,
    layout,
  } = options

  const pngBuffer = await renderComposition({
    brand,
    headline,
    contentImage,
    ratio,
    logoPath,
    noLogo,
    designZone,
    topic,
    seed,
    layout,
  })

  return pngBuffer
}

// Re-export types — canonical source is render.ts
export type { AspectRatio } from './renderer/render'
export { ASPECT_RATIOS } from './renderer/render'
