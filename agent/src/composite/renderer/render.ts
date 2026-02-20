/**
 * renderComposition — server-side composition renderer.
 *
 * Loads brand visual config, picks a named layout, then rasterises
 * via the node-canvas layered pipeline (BrandFrame).
 */

import { existsSync } from 'fs'

// @ts-expect-error registerFont exists at runtime but isn't in canvas type declarations
import { registerFont } from 'canvas'
import { renderBrandFrame } from './BrandFrame'
import { loadBrandVisual } from '../../core/visual'
import { buildStylePlan, computeLayout } from '../layouts'

/** Track which fonts have already been registered (registerFont is global, once per process) */
const registeredFonts = new Set<string>()

/** Platform aspect ratio presets */
export const ASPECT_RATIOS = {
  square: { width: 1080, height: 1080, label: '1:1 (Instagram feed)' },
  portrait: { width: 1080, height: 1350, label: '4:5 (Instagram feed)' },
  story: { width: 1080, height: 1920, label: '9:16 (Stories)' },
  landscape: { width: 1200, height: 675, label: '16:9 (Twitter/LinkedIn)' },
  wide: { width: 1200, height: 627, label: '1.91:1 (LinkedIn)' },
} as const

export type AspectRatio = keyof typeof ASPECT_RATIOS

export interface RenderCompositionOptions {
  brand: string
  headline: string
  contentImage?: Buffer
  ratio: AspectRatio
  logoPath?: string
  noLogo?: boolean
  /** Topic string — seeds deterministic layout selection */
  topic?: string
  /** Stable seed for reproducible layout/palette selection (e.g. queue id) */
  seed?: string
}

/**
 * Render a single still frame of a brand composition, returning a PNG buffer.
 */
export async function renderComposition(options: RenderCompositionOptions): Promise<Buffer> {
  const { brand, headline, contentImage, ratio, logoPath, noLogo = false, topic, seed } = options

  const visual = loadBrandVisual(brand)
  const { width, height } = ASPECT_RATIOS[ratio]
  const hasImage = !!contentImage

  // Register custom font if brand provides a font file path
  const { font: fontFamily, fontFile, weight: fontWeight } = visual.typography.headline
  if (fontFile && !registeredFonts.has(fontFile) && existsSync(fontFile)) {
    registerFont(fontFile, { family: fontFamily, weight: String(fontWeight) })
    registeredFonts.add(fontFile)
    console.log(`[render] Registered font: ${fontFamily} (${fontFile})`)
  }

  const stylePlan = buildStylePlan({
    visual,
    topic: topic ?? headline,
    hasImage,
    seed,
  })

  const renderVisual = {
    ...visual,
    density: stylePlan.density,
    alignment: stylePlan.alignment,
    background: stylePlan.background,
  }

  const layout = computeLayout(stylePlan.layoutName, width, height, renderVisual, topic, seed)

  // Resolve logo path: prefer visual config, fall back to param
  const visualLogoPath = noLogo ? undefined : (
    stylePlan.background === 'dark' ? visual.logo.dark : visual.logo.light
  )
  const resolvedLogoPath = noLogo ? undefined : (visualLogoPath ?? logoPath)

  console.log(`[render] ${brand} ${ratio} (${width}x${height}) layout=${stylePlan.layoutName}`)

  return renderBrandFrame({
    width,
    height,
    visual,
    layoutName: stylePlan.layoutName,
    background: layout.background,
    textSize: layout.textSize,
    bgColorIndex: layout.bgColorIndex,
    imageDim: layout.imageDim,
    imageZone: layout.imageZone,
    textZone: layout.textZone,
    logoZone: layout.logoZone,
    headline,
    contentImage,
    logoPath: resolvedLogoPath,
  })
}
