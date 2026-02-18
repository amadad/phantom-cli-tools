/**
 * Root.tsx — Composition root (documentation / future Remotion integration).
 *
 * This file documents how the BrandFrame composition would be registered in a
 * Remotion studio setup. Currently, server-side rendering uses BrandFrame via
 * node-canvas (see render.ts). If Chromium becomes available in this
 * environment, wiring up @remotion/renderer's registerRoot() here enables
 * full Remotion rendering without changing any caller code.
 *
 * Architecture:
 *
 *   <BrandFrame>        ← injects brand tokens as CSS custom properties
 *     <GraphicLayer />  ← background, gradient overlays, accent shapes, logo
 *     <ImageLayer />    ← AI-generated content image (fills imageZone)
 *     <TypeLayer />     ← headline text (font/size/color from tokens)
 *   </BrandFrame>
 *
 * Layer order is intentional: graphic behind image, text always on top.
 */

// NOTE: This file is not imported at runtime. It exists as architectural
// documentation and a migration target for future Remotion integration.
// The actual rendering path is: render.ts → BrandFrame.ts → layers/*.ts

export {}
