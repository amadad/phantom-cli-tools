/**
 * Texture command — generate p5.brush textured backgrounds via Pinch Tab.
 *
 * Text-zone-aware: marks interact with where the headline will be composited.
 *
 * Usage:
 *   texture <brand> [--style=<name>] [--size=<WxH>] [--seed=<n>] [--density=<level>] [--out=<path>] [--json]
 *   texture --list                       # List available styles
 *
 * Styles: editorial, expressive, architectural, gestural, layered
 */

import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { join, createSessionDir, slugify } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { loadBrandVisual } from '../core/visual'
import { computeLayout, buildStylePlan } from '../composite/layouts'
import { ASPECT_RATIOS } from '../composite/renderer/render'
import type { CommandContext } from '../cli/types'

export interface TextureCommandResult {
  imagePath: string
  style: string
  width: number
  height: number
}

const STYLES = ['editorial', 'expressive', 'architectural', 'gestural', 'layered'] as const
type TextureStyle = typeof STYLES[number]

// Legacy aliases
const STYLE_ALIASES: Record<string, TextureStyle> = {
  watercolor: 'editorial',
  crosshatch: 'architectural',
  brushstroke: 'gestural',
  mixed: 'layered',
  stipple: 'expressive',
}

/** Directory containing sketch.html and vendored JS */
const TEXTURES_DIR = resolve(dirname(new URL(import.meta.url).pathname), '../textures')

function paletteToColors(visual: ReturnType<typeof loadBrandVisual>): string {
  const p = visual.palette
  const colors = [
    p.accent,
    p.secondary,
    p.primary,
    p.warm ?? p.background,
  ].filter((c): c is string => Boolean(c)).map(c => c.replace('#', ''))
  return colors.join(',')
}

/** Compute the text zone for a given canvas size using brand layout system */
function computeTextZone(brand: string, width: number, height: number): { tx: number; ty: number; tw: number; th: number } {
  const visual = loadBrandVisual(brand)
  // Use overlay layout since textures default to full-bleed + text on top
  const layout = computeLayout('overlay', width, height, visual, 'texture')
  return {
    tx: layout.textZone.x,
    ty: layout.textZone.y,
    tw: layout.textZone.width,
    th: layout.textZone.height,
  }
}

export async function run(args: string[], _ctx?: CommandContext): Promise<TextureCommandResult> {
  // Handle --list
  if (args.includes('--list')) {
    console.log('\nAvailable texture styles:\n')
    console.log('  editorial      Watercolor wash + accent lines framing the text zone')
    console.log('  expressive     Bold arcs and strokes that interact with the headline')
    console.log('  architectural  Precise hatching and crop marks around the text')
    console.log('  gestural       Flowing strokes that sweep toward the text zone')
    console.log('  layered        All techniques: wash + hatch + strokes + accents')
    console.log(`\n  Use: texture <brand> --style=<name>\n`)
    return { imagePath: '', style: 'list', width: 0, height: 0 }
  }

  const parsed = extractBrandTopic(
    args,
    ['style', 'size', 'seed', 'out', 'density'],
    ['json'],
  )

  const brand = parsed.brand
  const rawStyle = parsed.flags.style ?? 'editorial'
  const style = (STYLE_ALIASES[rawStyle] ?? rawStyle) as TextureStyle
  const density = parsed.flags.density ?? 'moderate'
  const seedStr = parsed.flags.seed
  const seed = seedStr ? parseInt(seedStr, 10) : Math.floor(Math.random() * 99999)
  const outPath = parsed.flags.out

  if (!STYLES.includes(style)) {
    const all = [...STYLES, ...Object.keys(STYLE_ALIASES)].join(', ')
    throw new Error(`Unknown style "${rawStyle}". Available: ${all}`)
  }

  // Parse size (default: 1200x675 for Twitter landscape)
  let width = 1200, height = 675
  if (parsed.flags.size) {
    const parts = parsed.flags.size.toLowerCase().split('x')
    if (parts.length === 2) {
      width = parseInt(parts[0], 10) || 1200
      height = parseInt(parts[1], 10) || 675
    }
  }

  // Build palette from brand
  const visual = loadBrandVisual(brand)
  const colors = paletteToColors(visual)
  const bg = visual.palette.background.replace('#', '')
  const accent = visual.palette.accent.replace('#', '')

  // Compute text zone from layout system
  const tz = computeTextZone(brand, width, height)

  // Build sketch URL
  const sketchPath = resolve(TEXTURES_DIR, 'sketch.html')
  if (!existsSync(sketchPath)) {
    throw new Error(`Sketch template not found: ${sketchPath}`)
  }

  const cacheBust = Date.now()
  const sketchUrl = `file://${sketchPath}?w=${width}&h=${height}&style=${style}&bg=${bg}&colors=${colors}&accent=${accent}&density=${density}&seed=${seed}&tx=${tz.tx}&ty=${tz.ty}&tw=${tz.tw}&th=${tz.th}&_=${cacheBust}`

  console.log(`[texture] Rendering ${width}x${height} style=${style} density=${density} seed=${seed}`)
  console.log(`[texture] Brand palette: #${bg} + ${colors.split(',').map(c => '#' + c).join(', ')}`)
  console.log(`[texture] Text zone: (${tz.tx}, ${tz.ty}) ${tz.tw}x${tz.th}`)

  const startMs = Date.now()

  // Navigate Pinch Tab to sketch
  try {
    execSync(`pinchtab nav "${sketchUrl}"`, { timeout: 30000, stdio: 'pipe' })
  } catch (e: unknown) {
    throw new Error(`Pinch Tab nav failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Wait for p5.brush to render
  const waitMs = (style === 'editorial' || style === 'layered') ? 6000 : 4000
  execSync(`sleep ${Math.ceil(waitMs / 1000)}`, { stdio: 'pipe' })

  // Screenshot to temp file
  const tmpPath = `/tmp/phantom-texture-${seed}.png`
  try {
    execSync(`pinchtab ss -o ${tmpPath}`, { timeout: 15000, stdio: 'pipe' })
  } catch (e: unknown) {
    throw new Error(`Pinch Tab screenshot failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Crop to exact canvas dimensions (screenshot includes viewport padding)
  const sharp = (await import('sharp')).default
  const cropped = await sharp(tmpPath)
    .extract({ left: 0, top: 0, width, height })
    .png()
    .toBuffer()

  const elapsed = Date.now() - startMs
  console.log(`[texture] Rendered in ${elapsed}ms`)

  // Write output
  let imagePath: string
  if (outPath) {
    imagePath = outPath
  } else {
    const dir = createSessionDir(slugify(style), '-texture')
    imagePath = join(dir, 'texture.png')
  }
  writeFileSync(imagePath, cropped)
  console.log(`[texture] Saved: ${imagePath}`)

  if (parsed.booleans.has('json')) {
    console.log(JSON.stringify({ imagePath, style, width, height, seed }))
  }

  return { imagePath, style, width, height }
}
