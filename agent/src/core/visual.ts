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
import { RENDERER_DEFAULTS, type RendererConfig, type LayoutProportions } from '../composite/renderer/defaults'

// ── Types ─────────────────────────────────────────────────────────────────

export type LayoutName = 'split' | 'overlay' | 'type-only' | 'card' | 'full-bleed'

export const ALL_LAYOUTS: LayoutName[] = ['split', 'overlay', 'type-only', 'card', 'full-bleed']

export type TypeGravity = 'top' | 'center' | 'bottom'
export type Density = 'relaxed' | 'moderate' | 'tight'
export type Alignment = 'center' | 'left' | 'asymmetric'
export type VisualBackground = 'light' | 'dark' | 'warm'

export interface VisualVariants {
  layoutWeights: Partial<Record<LayoutName, number>>
  density: Density[]
  alignment: Alignment[]
  background: VisualBackground[]
}

export interface VisualProfile extends Omit<VolumeContext, 'volume'> {
  /** Profile key selected from design/volume config */
  id: string
  density?: Density
  alignment?: Alignment
  background?: VisualBackground
  layoutWeights?: Partial<Record<LayoutName, number>>
}

export interface DesignProfileDescriptor {
  id: string
  profile: VisualProfile
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
  renderer: RendererConfig
}

export interface VolumeContext {
  volume: string
  field: string
  text: string
  accent: string | string[]
  imageTreatment: string
  saturation: string
  typeWeight: number
  typeSize: string
  typeGravity: TypeGravity
  graphicChannels: string | number
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
  renderer: RENDERER_DEFAULTS,
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
const VALID_GRAVITY: TypeGravity[] = ['top', 'center', 'bottom']
const VALID_LAYOUT_MAP = new Set<LayoutName>(ALL_LAYOUTS)

// ── helpers ────────────────────────────────────────────────────────────────

/** Map image treatment name to dimming amount (0 = full brightness, 1 = invisible) */
export function imageTreatmentToDim(treatment: string): number {
  switch (treatment) {
    case 'dark': return 0.55
    case 'subdued': return 0.35
    case 'balanced': return 0.20
    case 'prominent': return 0.10
    case 'hero': return 0
    default: return 0.20
  }
}

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

function normalizeOptionalScalarEnum<T>(
  raw: unknown,
  valid: ReadonlyArray<T>,
): T | undefined {
  return valid.includes(raw as T) ? (raw as T) : undefined
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
    console.warn('[visual] Brand variants collapsed to defaults — check YAML config')
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

function normalizeTextSize(raw: unknown): string {
  if (typeof raw !== 'string') return 'md'

  const text = raw.toLowerCase().trim()
  if (text.includes('display') || text.includes('xl')) return 'display'
  if (text.includes('large') || text === 'lg' || text === 'l') return 'lg'
  if (text.includes('medium') || text === 'md' || text === 'm') return 'md'
  if (text === 'sm-md' || text === 'md-sm') return 'md'
  if (text.includes('small') || text === 'sm' || text === 's') return 'sm'

  return 'md'
}

function getDesignZones(rawVisual: Record<string, unknown>): Record<string, unknown> {
  const zonesSource = asRecord((rawVisual as Record<string, unknown>).design)
  const designSection = asRecord((zonesSource as Record<string, unknown>).zones)
  const legacyZoneSource = asRecord((rawVisual as Record<string, unknown>).volume_zones)
  const directZoneSource = Object.fromEntries(
    Object.entries(zonesSource).filter(
      ([key]) => !['zones', 'defaults', 'default', 'default_profile', 'defaultDesign'].includes(key),
    ),
  )

  return Object.keys(designSection).length > 0
    ? designSection
    : Object.keys(directZoneSource).length > 0
      ? directZoneSource
      : legacyZoneSource
}

function resolveDesignValue(
  rawVisual: Record<string, unknown>,
  requestedProfile?: string,
): VisualProfile | null {
  const zoneSource = getDesignZones(rawVisual)

  if (Object.keys(zoneSource).length === 0) return null

  const normalizedKeys = new Map<string, string>()
  for (const key of Object.keys(zoneSource)) {
    normalizedKeys.set(key.toLowerCase().trim(), key)
  }

  const palette = asRecord((rawVisual as Record<string, unknown>).palette)
  const rawLayoutList = (rawVisual as Record<string, unknown>).layouts
  const layouts = normalizeLayoutList(rawLayoutList)
  const designMeta = asRecord((rawVisual as Record<string, unknown>).design)
  const resolvedDefaults = asRecord(designMeta.defaults)
  const defaultProfile = firstDefined(
    asString(resolvedDefaults.default),
    asString(designMeta.default),
    asString(designMeta.default_profile),
    asString(resolvedDefaults.default_profile),
    asString(resolvedDefaults.defaultDesign),
    asString((rawVisual as Record<string, unknown>).default_volume),
  )

  const candidates = [requestedProfile, defaultProfile, 'whisper']
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
  const selectedRaw = candidates
    .map((value) => normalizedKeys.get(value.toLowerCase().trim()))
    .find((value): value is string => Boolean(value))
    || Object.keys(zoneSource)[0]

  if (!selectedRaw) return null

  const selected = zoneSource[selectedRaw]
  const zone = asRecord(selected)
  const color = asRecord(zone.color)
  const image = asRecord(zone.image)
  const type = asRecord(zone.type)
  const graphic = asRecord(zone.graphic)
  const layout = asRecord(zone.layout)

  const layoutWeights = normalizeLayoutWeights(
    layout.layoutWeights ?? zone.layoutWeights,
    layouts,
  )
  const density = normalizeOptionalScalarEnum<Density>(
    (layout.density ?? zone.density),
    VALID_DENSITY,
  )
  const alignment = normalizeOptionalScalarEnum<Alignment>(
    (layout.alignment ?? zone.alignment),
    VALID_ALIGNMENT,
  )
  const background = normalizeOptionalScalarEnum<VisualBackground>(
    (layout.background ?? zone.background),
    VALID_BACKGROUND,
  )

  const field = resolvePaletteToken(color.field, palette, '#FDFBF7')
  const text = resolvePaletteToken(color.text, palette, '#1E1B16')
  const accent = resolveAccentValue(color.accent ?? color.accents, palette, text)
  const imageTreatment = typeof image.treatment === 'string' ? image.treatment : 'balanced'
  const saturation = typeof image.saturation === 'string' ? image.saturation : 'mid'
  const graphicChannels = typeof graphic.channels === 'string' || typeof graphic.channels === 'number'
    ? graphic.channels
    : 2
  const typeWeight = normalizePositiveInt(type.weight, 400)
  const typeSize = normalizeTextSize(type.size)
  const typeGravity = normalizeScalarEnum<TypeGravity>(type.gravity, VALID_GRAVITY, 'top')

  return {
    id: selectedRaw,
    field,
    text,
    accent,
    imageTreatment,
    saturation,
    typeWeight,
    typeSize,
    typeGravity,
    graphicChannels,
    density,
    alignment,
    background,
    layoutWeights,
  }
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value): value is T => value !== undefined)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function resolvePaletteToken(
  value: unknown,
  palette: Record<string, unknown>,
  fallback: string,
): string {
  if (typeof value !== 'string') return fallback

  const token = value.trim()
  if (!token) return fallback

  const exact = palette[token]
  if (typeof exact === 'string') return exact

  const lower = palette[token.toLowerCase()]
  if (typeof lower === 'string') return lower

  return token
}

function resolveAccentValue(
  value: unknown,
  palette: Record<string, unknown>,
  fallback: string,
): string | string[] {
  if (Array.isArray(value)) {
    const resolved = value
      .map((entry) => resolvePaletteToken(entry, palette, ''))
      .filter((entry) => entry.length > 0)
    return resolved.length > 0 ? resolved : fallback
  }

  return resolvePaletteToken(value, palette, fallback)
}

// ── Renderer config ───────────────────────────────────────────────────────

function resolveRendererConfig(raw: unknown): RendererConfig {
  const src = asRecord(raw)
  const rawMargins = asRecord(src.margins)
  const rawLogo = asRecord(src.logo)
  const rawType = asRecord(src.type)
  const rawGraphic = asRecord(src.graphic)
  const rawLayouts = asRecord(src.layouts)

  const layouts: Partial<Record<string, LayoutProportions>> = {}
  for (const [key, defaults] of Object.entries(RENDERER_DEFAULTS.layouts)) {
    const overrides = asRecord(rawLayouts[key])
    layouts[key] = { ...defaults, ...overrides }
  }

  return {
    margins: { ...RENDERER_DEFAULTS.margins, ...rawMargins } as RendererConfig['margins'],
    logo: { ...RENDERER_DEFAULTS.logo, ...rawLogo } as RendererConfig['logo'],
    layouts,
    type: { ...RENDERER_DEFAULTS.type, ...rawType } as RendererConfig['type'],
    graphic: { ...RENDERER_DEFAULTS.graphic, ...rawGraphic } as RendererConfig['graphic'],
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
  const renderer = resolveRendererConfig(rawVisual.renderer)

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
    renderer,
  }
}

export function resolveDesignProfile(brandName: string, profile?: string): VisualProfile | null {
  const brand = loadBrand(brandName) as { visual?: unknown }
  const visual = asRecord(brand.visual)
  return resolveDesignValue(visual, profile)
}

export function listDesignProfiles(brandName: string): DesignProfileDescriptor[] {
  const brand = loadBrand(brandName) as { visual?: unknown }
  const rawVisual = asRecord(brand.visual)
  const designZones = getDesignZones(rawVisual)

  return Object.keys(designZones).map((id) => {
    const profile = resolveDesignValue(rawVisual, id)
    if (!profile) {
      throw new Error(`Failed to resolve design profile "${id}" for brand "${brandName}"`)
    }
    return { id, profile }
  })
}

export function resolveVolumeContext(brandName: string, volume?: string): VolumeContext | null {
  const profile = resolveDesignProfile(brandName, volume)
  if (!profile) return null

  const { id, ...context } = profile
  return { ...context, volume: id }
}
