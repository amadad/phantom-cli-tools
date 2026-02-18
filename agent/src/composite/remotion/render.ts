/**
 * renderComposition — server-side composition renderer.
 *
 * Architecture note: The task specified Remotion (@remotion/renderer) as the
 * preferred renderer. However, Remotion's renderStill() requires a headless
 * Chromium browser (via puppeteer), which is not available in this environment.
 * We implement the same layered BrandFrame/ImageLayer/GraphicLayer/TypeLayer
 * architecture using node-canvas as the renderer — a pure-Node.js canvas that
 * requires no browser binary. The architectural separation (layer system,
 * token-driven styling) is preserved; only the rasterisation engine differs.
 *
 * The function signature and behaviour are identical to what Remotion's
 * renderStill integration would expose — callers don't need to know which
 * renderer is in use.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getProjectRoot } from '../../core/paths'
import { TEMPLATES, ASPECT_RATIOS, zoneToPixels, type AspectRatio } from '../templates'
import { renderBrandFrame } from './BrandFrame'
import type { BrandTokens } from './types'

export interface RenderCompositionOptions {
  brand: string
  headline: string
  contentImage: Buffer
  template: string
  ratio: 'square' | 'portrait' | 'story' | 'landscape' | 'wide'
  logoPath?: string
}

/**
 * Load brand tokens from the generated tokens.json file.
 * Throws if the file does not exist — run `node tokens/build.js` first.
 */
function loadBrandTokens(brandName: string): BrandTokens {
  const tokenPath = join(getProjectRoot(), 'brands', brandName, 'tokens.json')
  if (!existsSync(tokenPath)) {
    throw new Error(
      `Brand tokens not found: ${tokenPath}\n` +
      `Run 'node tokens/build.js' from the project root to generate them.`
    )
  }
  return JSON.parse(readFileSync(tokenPath, 'utf-8')) as BrandTokens
}

/**
 * Render a single still frame of a brand composition, returning a PNG buffer.
 *
 * Uses BrandFrame with three explicit layers:
 *   ImageLayer   → AI-generated content image
 *   GraphicLayer → Brand framing, overlays, accent shapes, logo
 *   TypeLayer    → Headline text (token-driven font/color/size)
 */
export async function renderComposition(options: RenderCompositionOptions): Promise<Buffer> {
  const { brand, headline, contentImage, template: templateName, ratio, logoPath } = options

  // Load brand design tokens
  const tokens = loadBrandTokens(brand)

  // Resolve template config and variant
  const templateConfig = TEMPLATES[templateName]
  if (!templateConfig) {
    throw new Error(
      `Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  const variant = templateConfig.variants[ratio]
  if (!variant) {
    const available = Object.keys(templateConfig.variants).join(', ')
    throw new Error(
      `Template '${templateName}' doesn't support ratio '${ratio}'. Available: ${available}`
    )
  }

  const { width, height } = variant

  // Convert percentage zones → pixel coordinates
  const imageZone = zoneToPixels(variant.imageZone, width, height)
  const textZone  = zoneToPixels(variant.textZone,  width, height)
  const logoZone  = zoneToPixels(variant.logoZone,  width, height)

  console.log(`[renderComposition] brand=${brand} template=${templateName} ratio=${ratio} (${width}x${height})`)

  return renderBrandFrame({
    width,
    height,
    tokens,
    template: templateName,
    background: templateConfig.background,
    textSize: templateConfig.textSize,
    imageZone,
    textZone,
    logoZone,
    headline,
    contentImage,
    logoPath,
  })
}
