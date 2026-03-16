/**
 * Named layout system — replaces the 5-axis continuous layout engine.
 *
 * Five named layouts, each a pure function: (w, h, visual) → LayoutZones.
 * Brand `density` controls margins, `alignment` controls text position,
 * `background` + `palette` control colors.
 *
 * Selection: deterministic from topic hash over the brand's allowed layouts.
 */

import type { BrandVisual, Density, LayoutName, Alignment, VisualBackground, VisualProfile } from '../core/visual'
import type { RendererConfig } from './renderer/defaults'
import type { PixelZone } from './renderer/types'

// ── Types ───────────────────────────────────────────────────────────────────

export type { PixelZone }

export type TextSize = 'lg' | 'md' | 'sm' | 'display'

export interface LayoutResult {
  name: LayoutName
  imageZone: PixelZone
  textZone: PixelZone
  logoZone: PixelZone
  background: 'light' | 'dark' | 'warm'
  textSize: TextSize
  bgColorIndex: number
  imageDim: number
}

const EMPTY_ZONE: PixelZone = { x: 0, y: 0, width: 0, height: 0 }

// ── Margin helpers ──────────────────────────────────────────────────────────

function marginFor(density: Density, minDim: number, margins: RendererConfig['margins']): number {
  return Math.round(minDim * margins[density])
}

// ── Hashing ─────────────────────────────────────────────────────────────────

/** Deterministic string → 0..max-1 (FNV-1a) */
function hashToIndex(s: string, max: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h % max
}

// ── Palette builder ─────────────────────────────────────────────────────────

export function buildPalette(v: BrandVisual): string[] {
  const { background: bg, palette: p, renderer: rc } = v
  if (bg === 'dark') return [p.primary, p.dark ?? rc.graphic.fallbackDark, p.accent, rc.graphic.fallbackAccent]
  if (bg === 'warm') return [p.warm ?? p.background, p.background, p.accent, p.primary]
  return [p.background, p.warm ?? p.background, p.accent, p.primary]
}

// ── Named layouts ───────────────────────────────────────────────────────────

function layoutSplit(w: number, h: number, v: BrandVisual): LayoutResult {
  const pad = marginFor(v.density, Math.min(w, h), v.renderer.margins)
  const cfg = v.renderer.layouts.split ?? {}
  const vertical = h / w > (cfg.verticalThreshold ?? 0.85)

  let imageZone: PixelZone
  let textZone: PixelZone

  if (vertical) {
    const imgH = Math.round((h - pad * 3) * (cfg.imageHeight ?? 0.55))
    imageZone = { x: pad, y: pad, width: w - pad * 2, height: imgH }
    textZone = { x: pad, y: pad + imgH + pad, width: w - pad * 2, height: h - imgH - pad * 3 }
  } else {
    const imgW = Math.round((w - pad * 3) * (cfg.imageWidth ?? 0.5))
    imageZone = { x: pad, y: pad, width: imgW, height: h - pad * 2 }
    const txtX = pad + imgW + pad
    const txtH = Math.round((h - pad * 2) * (cfg.textHeight ?? 0.6))
    const txtY = v.alignment === 'center'
      ? pad + Math.round(((h - pad * 2) - txtH) / 2)
      : pad + Math.round((h - pad * 2) * (cfg.textYOffset ?? 0.15))
    textZone = { x: txtX, y: txtY, width: w - txtX - pad, height: txtH }
  }

  return {
    name: 'split',
    imageZone,
    textZone,
    logoZone: logoBottom(w, h, pad, v.alignment, v.renderer.logo),
    background: v.background,
    textSize: 'lg',
    bgColorIndex: 0,
    imageDim: 0,
  }
}

function layoutOverlay(w: number, h: number, v: BrandVisual): LayoutResult {
  const pad = marginFor(v.density, Math.min(w, h), v.renderer.margins)
  const cfg = v.renderer.layouts.overlay ?? {}
  const imageZone: PixelZone = { x: 0, y: 0, width: w, height: h }

  const textW = Math.round(w * (cfg.textWidth ?? 0.7))
  const textH = Math.round(h * (cfg.textHeight ?? 0.45))
  let tx: number, ty: number

  if (v.alignment === 'center') {
    tx = Math.round((w - textW) / 2)
    ty = Math.round((h - textH) * (cfg.centerY ?? 0.45))
  } else if (v.alignment === 'asymmetric') {
    tx = w - textW - pad
    ty = h - textH - pad - Math.round(h * (cfg.asymmetricYOffset ?? 0.06))
  } else {
    tx = pad + Math.round(w * (cfg.leftXOffset ?? 0.04))
    ty = Math.round((h - textH) * (cfg.centerY ?? 0.45))
  }

  return {
    name: 'overlay',
    imageZone,
    textZone: { x: tx, y: ty, width: textW, height: textH },
    logoZone: logoBottom(w, h, pad, v.alignment, v.renderer.logo),
    background: v.background,
    textSize: 'lg',
    bgColorIndex: 0,
    imageDim: 0.4,
  }
}

function layoutTypeOnly(w: number, h: number, v: BrandVisual): LayoutResult {
  const pad = marginFor(v.density, Math.min(w, h), v.renderer.margins)
  const cfg = v.renderer.layouts['type-only'] ?? {}
  const textW = w - pad * 2
  const textH = Math.round((h - pad * 2) * (cfg.textHeight ?? 0.65))
  let ty: number

  if (v.alignment === 'center') {
    ty = pad + Math.round(((h - pad * 2) - textH) * (cfg.centerY ?? 0.4))
  } else if (v.alignment === 'asymmetric') {
    ty = pad + Math.round((h - pad * 2) * (cfg.asymmetricY ?? 0.15))
  } else {
    ty = pad + Math.round((h - pad * 2) * (cfg.leftY ?? 0.1))
  }

  return {
    name: 'type-only',
    imageZone: EMPTY_ZONE,
    textZone: { x: pad, y: ty, width: textW, height: textH },
    logoZone: logoBottom(w, h, pad, v.alignment, v.renderer.logo),
    background: v.background,
    textSize: 'display',
    bgColorIndex: 0,
    imageDim: 0,
  }
}

function layoutCard(w: number, h: number, v: BrandVisual): LayoutResult {
  const pad = marginFor(v.density, Math.min(w, h), v.renderer.margins)
  const cfg = v.renderer.layouts.card ?? {}
  const imgH = Math.round((h - pad * 2) * (cfg.imageHeight ?? 0.65))
  const imageZone: PixelZone = { x: pad, y: pad, width: w - pad * 2, height: imgH }

  const txtY = pad + imgH + Math.round(pad * (cfg.textGap ?? 0.5))
  const txtH = h - txtY - pad
  const textZone: PixelZone = { x: pad, y: txtY, width: w - pad * 2, height: txtH }

  return {
    name: 'card',
    imageZone,
    textZone,
    logoZone: logoBottom(w, h, pad, v.alignment, v.renderer.logo),
    background: v.background,
    textSize: 'md',
    bgColorIndex: 0,
    imageDim: 0,
  }
}

function layoutFullBleed(w: number, h: number, v: BrandVisual): LayoutResult {
  const pad = marginFor(v.density, Math.min(w, h), v.renderer.margins)
  const cfg = v.renderer.layouts['full-bleed'] ?? {}
  const logoW = Math.round(w * v.renderer.logo.width)
  const logoH = Math.round(h * v.renderer.logo.height)

  return {
    name: 'full-bleed',
    imageZone: { x: 0, y: 0, width: w, height: h },
    textZone: { x: pad, y: h - pad - Math.round(h * (cfg.textYOffset ?? 0.08)), width: w * (cfg.textWidth ?? 0.5), height: Math.round(h * (cfg.textHeight ?? 0.06)) },
    logoZone: { x: w - logoW - pad, y: pad, width: logoW, height: logoH },
    background: v.background,
    textSize: 'sm',
    bgColorIndex: 0,
    imageDim: cfg.imageDim ?? 0.15,
  }
}

// ── Logo helper ─────────────────────────────────────────────────────────────

function logoBottom(w: number, h: number, pad: number, alignment: string, logo: RendererConfig['logo']): PixelZone {
  const logoW = Math.round(w * logo.width)
  const logoH = Math.round(h * logo.height)
  const lp = pad + Math.round(Math.min(w, h) * logo.padding)
  if (alignment === 'asymmetric') {
    return { x: lp, y: h - logoH - lp, width: logoW, height: logoH }
  }
  return { x: w - logoW - lp, y: h - logoH - lp, width: logoW, height: logoH }
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const LAYOUT_FNS: Record<LayoutName, (w: number, h: number, v: BrandVisual) => LayoutResult> = {
  'split': layoutSplit,
  'overlay': layoutOverlay,
  'type-only': layoutTypeOnly,
  'card': layoutCard,
  'full-bleed': layoutFullBleed,
}

/**
 * Compute layout zones for a given layout name, canvas size, and brand visual.
 * Also resolves bgColorIndex from topic hash.
 *
 * @param seed - Optional stable seed for palette rotation. Falls back to topic string.
 */
export function computeLayout(
  layoutName: LayoutName,
  width: number,
  height: number,
  visual: BrandVisual,
  topic?: string,
  seed?: string,
): LayoutResult {
  const fn = LAYOUT_FNS[layoutName]
  const result = fn(width, height, visual)

  const colorSeed = seed ?? topic ?? 'default'
  result.bgColorIndex = hashToIndex(colorSeed, visual.paletteRotation)

  return result
}

// ── Style planning (deterministic layout + variant selection) ──────────────

export interface StylePlan {
  layoutName: LayoutName
  density: Density
  alignment: Alignment
  background: VisualBackground
}

interface StylePlanOptions {
  visual: BrandVisual
  topic: string
  hasImage: boolean
  seed?: string
  designProfile?: VisualProfile
  /** Force a specific layout, bypassing deterministic selection */
  layoutOverride?: LayoutName
}

function chooseWithUniformPriority<T extends string>(values: readonly T[], seed: string): T {
  return values[hashToIndex(seed, values.length)]
}

function chooseFromWeights<T extends string>(
  values: readonly T[],
  seed: string,
  weightLookup: (value: T) => number,
): T {
  if (values.length === 1) return values[0]

  let totalWeight = 0
  for (const value of values) {
    totalWeight += Math.max(1, weightLookup(value))
  }

  if (totalWeight <= 0) return chooseWithUniformPriority(values, seed)

  let cursor = hashToIndex(seed, totalWeight)
  for (const value of values) {
    cursor -= Math.max(1, weightLookup(value))
    if (cursor < 0) return value
  }

  return values[values.length - 1]
}

function chooseVisualProperty<T extends string>(
  values: readonly T[],
  seed: string,
  fallback: T,
): T {
  if (values.length === 0) return fallback
  return chooseWithUniformPriority(values, seed)
}

function normalizeSeed(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(':')
}

function filterLayouts(visual: BrandVisual, hasImage: boolean): LayoutName[] {
  if (!hasImage) {
    const imageless = visual.layouts.filter((layout) => layout === 'type-only')
    return imageless.length > 0 ? imageless : ['type-only']
  }

  // Has image — exclude type-only so the image is actually used
  const imageCapable = visual.layouts.filter((layout) => layout !== 'type-only')
  return imageCapable.length > 0 ? imageCapable : ['split']
}

/**
 * Return true when brand config can produce image-based frames.
 */
export function canRenderWithImage(visual: BrandVisual): boolean {
  return visual.layouts.some((layout) => layout !== 'type-only')
}

/**
 * Build one deterministic style plan from brand config.
 */
export function buildStylePlan({
  visual,
  topic,
  hasImage,
  seed,
  designProfile,
  layoutOverride,
}: StylePlanOptions): StylePlan {
  const topicSeed = normalizeSeed(seed, topic)

  const validLayouts = filterLayouts(visual, hasImage)
  const layoutWeights = designProfile?.layoutWeights && Object.keys(designProfile.layoutWeights).length > 0
    ? designProfile.layoutWeights
    : visual.variants.layoutWeights

  const layoutName = layoutOverride ?? chooseFromWeights(
    validLayouts,
    normalizeSeed(topicSeed, 'layout'),
    (layout) => {
      const configuredWeight = layoutWeights[layout]
      if (!configuredWeight) return 1
      return Math.max(1, configuredWeight)
    },
  )

  const density = chooseVisualProperty(
    designProfile?.density ? [designProfile.density] : visual.variants.density,
    normalizeSeed(topicSeed, 'density'),
    visual.density,
  )

  const alignment = chooseVisualProperty(
    designProfile?.alignment ? [designProfile.alignment] : visual.variants.alignment,
    normalizeSeed(topicSeed, 'alignment'),
    visual.alignment,
  )

  const background = chooseVisualProperty(
    designProfile?.background ? [designProfile.background] : visual.variants.background,
    normalizeSeed(topicSeed, 'background'),
    visual.background,
  )

  return {
    layoutName,
    density,
    alignment,
    background,
  }
}
