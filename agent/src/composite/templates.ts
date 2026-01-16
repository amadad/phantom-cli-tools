/**
 * Template definitions with aspect ratio variants
 *
 * Zones are defined as percentages [x%, y%, width%, height%]
 * This allows templates to scale to any size while maintaining proportions
 */

export interface ZonePercent {
  x: number      // % from left
  y: number      // % from top
  width: number  // % of total width
  height: number // % of total height
}

export interface TemplateVariant {
  width: number
  height: number
  imageZone: ZonePercent
  textZone: ZonePercent
  logoZone: ZonePercent
}

export interface TemplateConfig {
  name: string
  description: string
  background: 'light' | 'dark' | 'warm'
  textAlign: 'left' | 'center' | 'right'
  textSize: 'large' | 'medium' | 'small'
  imageStyle: 'photo' | 'abstract' | 'shapes'
  variants: Record<string, TemplateVariant>
}

/**
 * Aspect ratio presets
 */
export const ASPECT_RATIOS = {
  square: { width: 1080, height: 1080, label: '1:1 (Instagram feed)' },
  portrait: { width: 1080, height: 1350, label: '4:5 (Instagram feed)' },
  story: { width: 1080, height: 1920, label: '9:16 (Stories)' },
  landscape: { width: 1200, height: 675, label: '16:9 (Twitter/LinkedIn)' },
  wide: { width: 1200, height: 627, label: '1.91:1 (LinkedIn)' },
} as const

export type AspectRatio = keyof typeof ASPECT_RATIOS

/**
 * Template definitions
 */
export const TEMPLATES: Record<string, TemplateConfig> = {
  // Classic polaroid - image dominant, caption below
  polaroid: {
    name: 'Polaroid',
    description: 'Image on top, caption below - classic and clean',
    background: 'warm',
    textAlign: 'left',
    textSize: 'medium',
    imageStyle: 'shapes',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 3, y: 3, width: 94, height: 72 },
        textZone: { x: 3, y: 78, width: 75, height: 15 },
        logoZone: { x: 80, y: 88, width: 17, height: 9 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 3, y: 3, width: 94, height: 72 },
        textZone: { x: 3, y: 77, width: 80, height: 14 },
        logoZone: { x: 82, y: 91, width: 15, height: 6 },
      },
      story: {
        width: 1080, height: 1920,
        imageZone: { x: 3, y: 3, width: 94, height: 55 },
        textZone: { x: 3, y: 60, width: 94, height: 25 },
        logoZone: { x: 78, y: 92, width: 18, height: 5 },
      },
    },
  },

  // Quote card - text dominant, small image accent
  quote: {
    name: 'Quote',
    description: 'Text-dominant with small image accent - for thought pieces',
    background: 'dark',
    textAlign: 'left',
    textSize: 'large',
    imageStyle: 'shapes',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 60, y: 5, width: 35, height: 35 },
        textZone: { x: 5, y: 45, width: 90, height: 40 },
        logoZone: { x: 5, y: 88, width: 18, height: 9 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 63, y: 4, width: 32, height: 28 },
        textZone: { x: 5, y: 38, width: 90, height: 40 },
        logoZone: { x: 5, y: 88, width: 15, height: 8 },
      },
      story: {
        width: 1080, height: 1920,
        imageZone: { x: 55, y: 3, width: 40, height: 22 },
        textZone: { x: 5, y: 28, width: 90, height: 50 },
        logoZone: { x: 5, y: 92, width: 20, height: 5 },
      },
    },
  },

  // Editorial - full bleed image with text strip
  editorial: {
    name: 'Editorial',
    description: 'Full bleed image with text strip - magazine style',
    background: 'light',
    textAlign: 'left',
    textSize: 'small',
    imageStyle: 'photo',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 0, y: 0, width: 100, height: 80 },
        textZone: { x: 4, y: 82, width: 75, height: 12 },
        logoZone: { x: 82, y: 86, width: 14, height: 10 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 0, y: 0, width: 100, height: 80 },
        textZone: { x: 4, y: 82, width: 80, height: 10 },
        logoZone: { x: 85, y: 92, width: 12, height: 6 },
      },
      landscape: {
        width: 1200, height: 675,
        imageZone: { x: 0, y: 0, width: 100, height: 75 },
        textZone: { x: 3, y: 78, width: 70, height: 18 },
        logoZone: { x: 85, y: 82, width: 12, height: 14 },
      },
    },
  },

  // Split - image on one side, text on other
  split: {
    name: 'Split',
    description: 'Image left, text right - balanced layout',
    background: 'light',
    textAlign: 'left',
    textSize: 'medium',
    imageStyle: 'abstract',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 0, y: 0, width: 50, height: 100 },
        textZone: { x: 54, y: 35, width: 42, height: 30 },
        logoZone: { x: 54, y: 85, width: 15, height: 10 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 0, y: 0, width: 50, height: 100 },
        textZone: { x: 54, y: 40, width: 42, height: 25 },
        logoZone: { x: 54, y: 90, width: 15, height: 6 },
      },
      landscape: {
        width: 1200, height: 675,
        imageZone: { x: 0, y: 0, width: 45, height: 100 },
        textZone: { x: 50, y: 30, width: 45, height: 40 },
        logoZone: { x: 50, y: 80, width: 12, height: 15 },
      },
    },
  },

  // Minimal - mostly text, tiny image accent
  minimal: {
    name: 'Minimal',
    description: 'Text-focused with subtle image accent - clean and modern',
    background: 'light',
    textAlign: 'center',
    textSize: 'large',
    imageStyle: 'abstract',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 40, y: 5, width: 20, height: 20 },
        textZone: { x: 10, y: 35, width: 80, height: 45 },
        logoZone: { x: 40, y: 88, width: 20, height: 8 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 40, y: 5, width: 20, height: 15 },
        textZone: { x: 10, y: 25, width: 80, height: 50 },
        logoZone: { x: 40, y: 90, width: 20, height: 6 },
      },
    },
  },

  // Banner - wide format for headers
  banner: {
    name: 'Banner',
    description: 'Wide landscape for LinkedIn/Twitter headers',
    background: 'warm',
    textAlign: 'left',
    textSize: 'medium',
    imageStyle: 'shapes',
    variants: {
      landscape: {
        width: 1200, height: 675,
        imageZone: { x: 50, y: 5, width: 47, height: 90 },
        textZone: { x: 5, y: 30, width: 42, height: 40 },
        logoZone: { x: 5, y: 80, width: 12, height: 15 },
      },
      wide: {
        width: 1200, height: 627,
        imageZone: { x: 52, y: 5, width: 45, height: 90 },
        textZone: { x: 5, y: 25, width: 44, height: 50 },
        logoZone: { x: 5, y: 82, width: 12, height: 14 },
      },
    },
  },

  // =============================================================================
  // MONOCHROME TEMPLATES - Dark backgrounds, white text, bold varied layouts
  // =============================================================================

  // Brutalist - massive headline top, image bottom right
  brutalist: {
    name: 'Brutalist',
    description: 'Massive headline dominates, image as accent - dark',
    background: 'dark',
    textAlign: 'left',
    textSize: 'large',
    imageStyle: 'abstract',
    variants: {
      square: {
        width: 1080, height: 1080,
        textZone: { x: 5, y: 8, width: 90, height: 45 },
        imageZone: { x: 50, y: 50, width: 48, height: 48 },
        logoZone: { x: 5, y: 88, width: 15, height: 8 },
      },
      portrait: {
        width: 1080, height: 1350,
        textZone: { x: 5, y: 5, width: 90, height: 35 },
        imageZone: { x: 40, y: 42, width: 58, height: 42 },
        logoZone: { x: 5, y: 92, width: 12, height: 5 },
      },
      story: {
        width: 1080, height: 1920,
        textZone: { x: 5, y: 5, width: 90, height: 35 },
        imageZone: { x: 5, y: 42, width: 90, height: 42 },
        logoZone: { x: 5, y: 90, width: 15, height: 6 },
      },
      landscape: {
        width: 1200, height: 675,
        textZone: { x: 4, y: 8, width: 55, height: 60 },
        imageZone: { x: 55, y: 15, width: 43, height: 70 },
        logoZone: { x: 4, y: 78, width: 10, height: 15 },
      },
    },
  },

  // Stack - headline stacked vertically, image beside
  stack: {
    name: 'Stack',
    description: 'Vertical headline stack with image column - dark'
    background: 'dark',
    textAlign: 'left',
    textSize: 'large',
    imageStyle: 'abstract',
    variants: {
      square: {
        width: 1080, height: 1080,
        textZone: { x: 5, y: 15, width: 60, height: 70 },
        imageZone: { x: 68, y: 5, width: 30, height: 90 },
        logoZone: { x: 5, y: 88, width: 12, height: 8 },
      },
      portrait: {
        width: 1080, height: 1350,
        textZone: { x: 5, y: 10, width: 55, height: 55 },
        imageZone: { x: 62, y: 5, width: 36, height: 70 },
        logoZone: { x: 5, y: 92, width: 10, height: 5 },
      },
      landscape: {
        width: 1200, height: 675,
        textZone: { x: 4, y: 10, width: 50, height: 75 },
        imageZone: { x: 58, y: 5, width: 40, height: 90 },
        logoZone: { x: 4, y: 82, width: 10, height: 12 },
      },
    },
  },

  // Bleed - image bleeds to edge, headline overlays bottom
  bleed: {
    name: 'Bleed',
    description: 'Full bleed image with headline bar - dark'
    background: 'dark',
    textAlign: 'left',
    textSize: 'large',
    imageStyle: 'abstract',
    variants: {
      square: {
        width: 1080, height: 1080,
        imageZone: { x: 0, y: 0, width: 100, height: 65 },
        textZone: { x: 5, y: 68, width: 90, height: 25 },
        logoZone: { x: 85, y: 5, width: 12, height: 8 },
      },
      portrait: {
        width: 1080, height: 1350,
        imageZone: { x: 0, y: 0, width: 100, height: 55 },
        textZone: { x: 5, y: 58, width: 90, height: 30 },
        logoZone: { x: 85, y: 5, width: 12, height: 5 },
      },
      landscape: {
        width: 1200, height: 675,
        imageZone: { x: 0, y: 0, width: 60, height: 100 },
        textZone: { x: 62, y: 15, width: 35, height: 55 },
        logoZone: { x: 62, y: 78, width: 12, height: 15 },
      },
    },
  },
}

/**
 * Convert percentage zone to pixel coordinates
 */
export function zoneToPixels(zone: ZonePercent, width: number, height: number) {
  return {
    x: Math.round((zone.x / 100) * width),
    y: Math.round((zone.y / 100) * height),
    width: Math.round((zone.width / 100) * width),
    height: Math.round((zone.height / 100) * height),
  }
}

/**
 * Get Gemini aspect ratio string for a variant
 */
export function getGeminiAspectRatio(variant: TemplateVariant): string {
  const { width, height } = variant
  const ratio = width / height

  if (Math.abs(ratio - 1) < 0.1) return '1:1'
  if (Math.abs(ratio - 4/5) < 0.1) return '4:5'
  if (Math.abs(ratio - 3/4) < 0.1) return '3:4'
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9'
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16'

  // Default based on orientation
  return ratio > 1 ? '16:9' : '3:4'
}

/**
 * Get image zone aspect ratio for Gemini
 */
export function getImageZoneAspectRatio(zone: ZonePercent): string {
  const ratio = zone.width / zone.height

  if (Math.abs(ratio - 1) < 0.2) return '1:1'
  if (ratio > 1.5) return '16:9'
  if (ratio > 1.2) return '4:3'
  if (ratio < 0.7) return '3:4'
  if (ratio < 0.9) return '4:5'

  return '1:1'
}

/**
 * List available templates and variants
 */
export function listTemplates(): void {
  console.log('\nAvailable Templates:\n')
  for (const [id, config] of Object.entries(TEMPLATES)) {
    console.log(`  ${id}: ${config.description}`)
    console.log(`    Background: ${config.background}, Text: ${config.textSize}`)
    console.log(`    Variants: ${Object.keys(config.variants).join(', ')}`)
    console.log()
  }
}
