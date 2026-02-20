/**
 * BrandVisual — unified visual configuration loaded from brand YAML.
 *
 * Single source of truth: brands/<name>/<name>-brand.yml → visual:
 * - no token/build layer
 * - no separate style files
 * - no template system in renderer input stage
 */

import { existsSync } from 'fs'
import { loadBrand } from './brand'
import { getBrandDir, join } from './paths'

// ── Types ─────────────────────────────────────────────────────────────────

export type LayoutName = 'split' | 'overlay' | 'type-only' | 'card' | 'full-bleed'

export const ALL_LAYOUTS: LayoutName[] = ['split', 'overlay', 'type-only', 'card', 'full-bleed']

export type Density = 'relaxed' | 'moderate' | 'tight'
export type Alignment = 'center' | 'left' | 'asymmetric'
export type VisualBackground = 'light' | 'dark' | 'warm'

export interface VisualVariants {
  layoutWeights: Partial<Record<LayoutName, number>>
  density: Density[]
  alignment: Alignment[]
  background: VisualBackground[]
}

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
  density: Density
  alignment: Alignment
  background: VisualBackground
  paletteRotation: number
  variants: VisualVariants
  image?: {
    style: string
    mood: string
    avoid: string[]
    prefer: string[]
    palette_instructions?: string
    model?: string
  }
}

// ── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_VISUAL: Omit<
  BrandVisual,
  'layouts' | 'density' | 'alignment' | 'background' | 'paletteRotation' | 'variants'
> = {
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
}

const DEFAULT_VARIANTS: VisualVariants = {
  layoutWeights: {},
  density: ['moderate'],
  alignment: ['center'],
  background: ['light'],
}

const DEFAULT_LAYOUTS: LayoutName[] = ['split', 'overlay', 'type-only', 'card']
const DEFAULT_DENSITY: Density = 'moderate'
const DEFAULT_ALIGNMENT: Alignment = 'center'
const DEFAULT_BACKGROUND: VisualBackground = 'light'
const DEFAULT_PALETTE_ROTATION = 4

const VALID_DENSITY: Density[] = ['relaxed', 'moderate', 'tight']
const VALID_ALIGNMENT: Alignment[] = ['center', 'left', 'asymmetric']
const VALID_BACKGROUND: VisualBackground[] = ['light', 'dark', 'warm']
const VALID_LAYOUT_MAP = new Set<LayoutName>(ALL_LAYOUTS)

// ── helpers ────────────────────────────────────────────────────────────────

function isLayoutName(value: unknown): value is LayoutName {
  return typeof value === 'string' && VALID_LAYOUT_MAP.has(value as LayoutName)
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(1, Math.floor(parsed))
}

function normalizeLayoutList(raw: unknown): LayoutName[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_LAYOUTS

  const filtered = raw
    .filter((candidate): candidate is LayoutName => isLayoutName(candidate))
    .filter((candidate, idx, arr) => arr.indexOf(candidate) === idx)

  return filtered.length > 0 ? filtered : DEFAULT_LAYOUTS
}

function normalizeImage(raw: unknown) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    style: typeof source.style === 'string' ? source.style : '',
    mood: typeof source.mood === 'string' ? source.mood : '',
    avoid: Array.isArray(source.avoid) ? source.avoid.filter((value): value is string => typeof value === 'string') : [],
    prefer: Array.isArray(source.prefer) ? source.prefer.filter((value): value is string => typeof value === 'string') : [],
    palette_instructions: typeof source.palette_instructions === 'string' ? source.palette_instructions : undefined,
    model: typeof source.model === 'string' ? source.model : undefined,
  }
}

function normalizeScalarEnum<T>(
  raw: unknown,
  valid: ReadonlyArray<T>,
  fallback: T,
): T {
  return valid.includes(raw as T) ? (raw as T) : fallback
}

function normalizeEnumList<T>(raw: unknown, valid: ReadonlyArray<T>, fallback: T): T[] {
  if (!Array.isArray(raw)) return [fallback]

  const values = raw.filter((value): value is T => valid.includes(value as T))
  return values.length > 0 ? values.filter((value, index, list) => list.indexOf(value) === index) : [fallback]
}

function normalizeLayoutWeights(
  raw: unknown,
  layouts: LayoutName[],
): Partial<Record<LayoutName, number>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const normalized: Partial<Record<LayoutName, number>> = {}
  const rawMap = raw as Record<string, unknown>
  let foundAny = false

  for (const [layout, weight] of Object.entries(rawMap)) {
    if (!isLayoutName(layout)) continue
    if (!layouts.includes(layout)) continue
    const parsed = normalizePositiveInt(weight, 0)
    if (parsed > 0) {
      normalized[layout] = parsed
      foundAny = true
    }
  }

  return foundAny ? normalized : {}
}

function resolveVariants(
  raw: Record<string, unknown>,
  scalarDensity: Density,
  scalarAlignment: Alignment,
  scalarBackground: VisualBackground,
  layouts: LayoutName[],
): VisualVariants {
  const rawVariants = (raw.variants ?? {}) as Record<string, unknown>

  const density = normalizeEnumList<Density>(
    rawVariants.density,
    VALID_DENSITY,
    scalarDensity,
  )
  const alignment = normalizeEnumList<Alignment>(
    rawVariants.alignment,
    VALID_ALIGNMENT,
    scalarAlignment,
  )
  const background = normalizeEnumList<VisualBackground>(
    rawVariants.background,
    VALID_BACKGROUND,
    scalarBackground,
  )

  if (
    density.length === 1 &&
    alignment.length === 1 &&
    background.length === 1 &&
    rawVariants.layoutWeights === undefined
  ) {
    // Keep explicit defaults out of object form to avoid surprising noise.
    return DEFAULT_VARIANTS
  }

  const layoutWeights = normalizeLayoutWeights(rawVariants.layoutWeights, layouts)

  return {
    layoutWeights,
    density,
    alignment,
    background,
  }
}

function resolvePaletteRotation(raw: unknown): number {
  return normalizePositiveInt(raw, DEFAULT_PALETTE_ROTATION)
}

function resolveImagePaths(brandDir: string, visualImage: { light?: string; dark?: string }): { light?: string; dark?: string } {
  return {
    light: visualImage.light ? (visualImage.light.startsWith('/') ? visualImage.light : join(brandDir, visualImage.light)) : undefined,
    dark: visualImage.dark ? (visualImage.dark.startsWith('/') ? visualImage.dark : join(brandDir, visualImage.dark)) : undefined,
  }
}

// ── Loader ────────────────────────────────────────────────────────────────

/**
 * Load BrandVisual from brand YAML.
 */
export function loadBrandVisual(brandName: string): BrandVisual {
  const brand = loadBrand(brandName)
  const rawVisual = (brand as { visual?: Record<string, unknown> }).visual ?? {}
  const rawPalette = (rawVisual.palette && typeof rawVisual.palette === 'object' && !Array.isArray(rawVisual.palette))
    ? (rawVisual.palette as Record<string, unknown>)
    : {}
  const rawTypography = (rawVisual.typography && typeof rawVisual.typography === 'object' && !Array.isArray(rawVisual.typography))
    ? (rawVisual.typography as Record<string, unknown>)
    : {}
  const rawHeadline = (rawTypography.headline && typeof rawTypography.headline === 'object' && !Array.isArray(rawTypography.headline))
    ? (rawTypography.headline as Record<string, unknown>)
    : {}
  const rawLogo = (rawVisual.logo && typeof rawVisual.logo === 'object' && !Array.isArray(rawVisual.logo))
    ? (rawVisual.logo as Record<string, unknown>)
    : {}
  const rawImage = rawVisual.image

  const brandDir = getBrandDir(brandName)

  const palette = {
    ...DEFAULT_VISUAL.palette,
    ...rawPalette,
  }

  const headline = {
    ...DEFAULT_VISUAL.typography.headline,
    ...rawHeadline,
    sizes: {
      ...DEFAULT_VISUAL.typography.headline.sizes,
      ...(rawHeadline.sizes && typeof rawHeadline.sizes === 'object' ? rawHeadline.sizes : {}),
    },
  }

  if (headline.fontFile && !headline.fontFile.startsWith('/')) {
    headline.fontFile = join(brandDir, headline.fontFile)
  }

  const rawLogoResolved = resolveImagePaths(brandDir, {
    light: typeof rawLogo.light === 'string' ? rawLogo.light : undefined,
    dark: typeof rawLogo.dark === 'string' ? rawLogo.dark : undefined,
  })

  const logo = {
    ...DEFAULT_VISUAL.logo,
    ...rawLogo,
    ...rawLogoResolved,
  }

  const layouts = normalizeLayoutList(rawVisual.layouts)
  const density = normalizeScalarEnum(rawVisual.density, VALID_DENSITY, DEFAULT_DENSITY)
  const alignment = normalizeScalarEnum(rawVisual.alignment, VALID_ALIGNMENT, DEFAULT_ALIGNMENT)
  const background = normalizeScalarEnum(rawVisual.background, VALID_BACKGROUND, DEFAULT_BACKGROUND)
  const paletteRotation = resolvePaletteRotation(rawVisual.paletteRotation)
  const image = normalizeImage(rawImage)
  const variants = resolveVariants(rawVisual, density, alignment, background, layouts)

  if (headline.fontFile && !existsSync(headline.fontFile)) {
    console.warn(`[visual] ${brandName}: missing fontFile "${headline.fontFile}"`)
  }

  if (logo.light && !existsSync(logo.light)) {
    console.warn(`[visual] ${brandName}: missing logo.light "${logo.light}"`)
  }

  if (logo.dark && !existsSync(logo.dark)) {
    console.warn(`[visual] ${brandName}: missing logo.dark "${logo.dark}"`)
  }

  return {
    ...DEFAULT_VISUAL,
    palette,
    typography: { headline },
    logo,
    layouts,
    density,
    alignment,
    background,
    paletteRotation,
    variants,
    image,
  }
}
