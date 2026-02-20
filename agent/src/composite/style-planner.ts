import type { BrandVisual, Density, LayoutName, Alignment, VisualBackground } from '../core/visual'

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
}

function hashToIndex(input: string, max: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h % max
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
}: StylePlanOptions): StylePlan {
  const topicSeed = normalizeSeed(seed, topic)

  const validLayouts = filterLayouts(visual, hasImage)
  const layoutName = chooseFromWeights(
    validLayouts,
    normalizeSeed(topicSeed, 'layout'),
    (layout) => {
      const configuredWeight = visual.variants.layoutWeights[layout]
      if (!configuredWeight) return 1
      return Math.max(1, configuredWeight)
    },
  )

  const density = chooseVisualProperty(
    visual.variants.density,
    normalizeSeed(topicSeed, 'density'),
    visual.density,
  )

  const alignment = chooseVisualProperty(
    visual.variants.alignment,
    normalizeSeed(topicSeed, 'alignment'),
    visual.alignment,
  )

  const background = chooseVisualProperty(
    visual.variants.background,
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
