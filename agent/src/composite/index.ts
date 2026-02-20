/**
 * composite: Poster generation
 */

export { generatePoster } from './poster'
export { ASPECT_RATIOS, type AspectRatio } from './renderer/render'
export { computeLayout, buildPalette } from './layouts'
export { buildStylePlan, canRenderWithImage } from './style-planner'
export type { LayoutResult, PixelZone } from './layouts'
