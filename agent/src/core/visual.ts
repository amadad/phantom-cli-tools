/**
 * BrandVisual — unified visual configuration loaded from brand YAML.
 *
 * Replaces:
 *   - BrandTokens (flat string-keyed map from tokens.json)
 *   - tokens/build.js pipeline
 *   - style.* section in brand YAML
 *
 * Single source of truth: brands/<name>/<name>-brand.yml → visual:
 */

import { existsSync } from 'fs'
import { loadBrand } from './brand'
import { getBrandDir, join } from './paths'

// ── Layout names ────────────────────────────────────────────────────────────

export type LayoutName = 'split' | 'overlay' | 'type-only' | 'card' | 'full-bleed'

export const ALL_LAYOUTS: LayoutName[] = ['split', 'overlay', 'type-only', 'card', 'full-bleed']

// ── BrandVisual type ────────────────────────────────────────────────────────

export interface BrandVisual {
  palette: {
    background: string
    primary: string
    accent: string
    secondary?: string
    warm?: string
    dark?: string
    light?: string
  }
  typography: {
    headline: {
      font: string
      weight: number
      lineHeight: number
      fontFile?: string
      sizes: { sm: number; md: number; lg: number; display: number }
      letterSpacing?: string
      transform?: string
    }
  }
  logo: {
    light?: string
    dark?: string
    colorOnLight: string
    colorOnDark: string
  }
  layouts: LayoutName[]
  density: 'relaxed' | 'moderate' | 'tight'
  alignment: 'center' | 'left' | 'asymmetric'
  background: 'light' | 'dark' | 'warm'
  paletteRotation: number
  image?: {
    style: string
    mood: string
    avoid: string[]
    prefer: string[]
    palette_instructions?: string
    model?: string
  }
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: BrandVisual = {
  palette: {
    background: '#FDFBF7',
    primary: '#1E1B16',
    accent: '#5046E5',
    secondary: '#3D3929',
    warm: '#FCEEE3',
    dark: '#111111',
    light: '#F7F7F2',
  },
  typography: {
    headline: {
      font: 'Alegreya',
      weight: 400,
      lineHeight: 1.15,
      sizes: { sm: 28, md: 50, lg: 84, display: 136 },
    },
  },
  logo: {
    colorOnLight: '#1E1B16',
    colorOnDark: '#FDFBF7',
  },
  layouts: ['split', 'overlay', 'type-only', 'card'],
  density: 'moderate',
  alignment: 'center',
  background: 'light',
  paletteRotation: 4,
}

// ── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load BrandVisual from the brand YAML `visual:` section.
 * Applies defaults for any missing fields. No build step required.
 */
export function loadBrandVisual(brandName: string): BrandVisual {
  const brand = loadBrand(brandName)
  const raw = (brand as any).visual ?? {}
  const brandDir = getBrandDir(brandName)

  // Palette: merge with defaults
  const palette = {
    ...DEFAULTS.palette,
    ...(raw.palette ?? {}),
  }

  // Typography: merge headline with defaults
  const rawHl = raw.typography?.headline ?? {}
  const headline = {
    ...DEFAULTS.typography.headline,
    ...rawHl,
    sizes: { ...DEFAULTS.typography.headline.sizes, ...(rawHl.sizes ?? {}) },
  }

  // Resolve fontFile to absolute path if relative
  if (headline.fontFile && !headline.fontFile.startsWith('/')) {
    headline.fontFile = join(brandDir, headline.fontFile)
  }

  // Logo: merge + resolve paths
  const rawLogo = raw.logo ?? {}
  const logo = {
    ...DEFAULTS.logo,
    ...rawLogo,
  }
  if (logo.light && !logo.light.startsWith('/')) {
    logo.light = join(brandDir, logo.light)
  }
  if (logo.dark && !logo.dark.startsWith('/')) {
    logo.dark = join(brandDir, logo.dark)
  }

  // Validate layouts: filter unknown, fallback to defaults
  let layouts: LayoutName[] = DEFAULTS.layouts
  if (Array.isArray(raw.layouts) && raw.layouts.length > 0) {
    const valid = raw.layouts.filter((l: string) => {
      if ((ALL_LAYOUTS as string[]).includes(l)) return true
      console.warn(`[visual] ${brandName}: unknown layout "${l}", skipping`)
      return false
    }) as LayoutName[]
    layouts = valid.length > 0 ? valid : DEFAULTS.layouts
  }

  // Validate paletteRotation > 0
  const paletteRotation = Math.max(1, Number(raw.paletteRotation) || DEFAULTS.paletteRotation)

  // Image config
  const rawImage = raw.image ?? {}
  const image = {
    style: rawImage.style ?? '',
    mood: rawImage.mood ?? '',
    avoid: Array.isArray(rawImage.avoid) ? rawImage.avoid : [],
    prefer: Array.isArray(rawImage.prefer) ? rawImage.prefer : [],
    ...(rawImage.palette_instructions ? { palette_instructions: rawImage.palette_instructions } : {}),
    ...(rawImage.model ? { model: rawImage.model } : {}),
  }

  // Validate enum fields
  const VALID_DENSITY = ['relaxed', 'moderate', 'tight'] as const
  const VALID_ALIGNMENT = ['center', 'left', 'asymmetric'] as const
  const VALID_BACKGROUND = ['light', 'dark', 'warm'] as const

  let density = DEFAULTS.density
  if (raw.density) {
    if (VALID_DENSITY.includes(raw.density)) {
      density = raw.density
    } else {
      console.warn(`[visual] ${brandName}: invalid density "${raw.density}", using "${DEFAULTS.density}"`)
    }
  }

  let alignment = DEFAULTS.alignment
  if (raw.alignment) {
    if (VALID_ALIGNMENT.includes(raw.alignment)) {
      alignment = raw.alignment
    } else {
      console.warn(`[visual] ${brandName}: invalid alignment "${raw.alignment}", using "${DEFAULTS.alignment}"`)
    }
  }

  let background = DEFAULTS.background
  if (raw.background) {
    if (VALID_BACKGROUND.includes(raw.background)) {
      background = raw.background
    } else {
      console.warn(`[visual] ${brandName}: invalid background "${raw.background}", using "${DEFAULTS.background}"`)
    }
  }

  const result: BrandVisual = {
    palette,
    typography: { headline },
    logo,
    layouts,
    density,
    alignment,
    background,
    paletteRotation,
    image,
  }

  // Asset preflight warnings
  if (headline.fontFile && !existsSync(headline.fontFile)) {
    console.warn(`[visual] ${brandName}: fontFile not found: ${headline.fontFile}`)
  }
  if (logo.light && !existsSync(logo.light)) {
    console.warn(`[visual] ${brandName}: logo.light not found: ${logo.light}`)
  }
  if (logo.dark && !existsSync(logo.dark)) {
    console.warn(`[visual] ${brandName}: logo.dark not found: ${logo.dark}`)
  }

  return result
}
