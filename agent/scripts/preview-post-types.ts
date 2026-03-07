/**
 * Preview: 6 post types × 3 colorways each, with alignment variation.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { createCanvas, registerFont } from 'canvas'
import { renderBrandFrame } from '../src/composite/renderer/BrandFrame'
import { computeLayout } from '../src/composite/layouts'
import { loadBrandVisual, type VisualProfile, type TypeGravity } from '../src/core/visual'
import type { BrandFrameProps } from '../src/composite/renderer/types'
import { createServer } from 'node:http'
import { readFileSync } from 'fs'
import { extname, join } from 'path'
import { execFileSync } from 'child_process'

const BRAND = 'givecare'
const W = 1080
const H = 1080

const visual = loadBrandVisual(BRAND)

const { font, fontFile, weight } = visual.typography.headline
if (fontFile && existsSync(fontFile)) {
  registerFont(fontFile, { family: font, weight: String(weight) })
}

// ── Expanded Palette ─────────────────────────────────────────────────────────
// Named color tokens — extends the brand palette for Labs
const C = {
  // Existing warm core
  ink:        '#1E1B16',
  cream:      '#FCEEE3',
  plum:       '#3B1F2B',
  peach:      '#FFE8D6',
  earth:      '#3D3929',
  background: '#FDFBF7',
  indigo:     '#5046E5',
  rust:       '#C45B2A',
  sage:       '#7A9E7E',
  // New: cool extension
  teal:       '#2A5C5A',
  slate:      '#3B4856',
  ice:        '#E8EDF2',
  // New: warm extension
  terracotta: '#B85C3A',
  ochre:      '#C49A3C',
  clay:       '#8B6B5B',
  // New: botanical
  moss:       '#4A6741',
  fern:       '#A8C5A0',
  // New: accent extension
  coral:      '#D4726A',
  berry:      '#7B3F61',
}

// ── Colorways ────────────────────────────────────────────────────────────────
// Each colorway is a field + text + accent triplet
interface Colorway {
  id: string
  label: string
  field: string
  text: string
  accent: string
}

const COLORWAYS: Colorway[] = [
  // Warm core
  { id: 'ink-cream',       label: 'Ink on Cream',     field: C.ink,        text: C.cream,      accent: C.earth },
  { id: 'plum-peach',      label: 'Plum Night',       field: C.plum,       text: C.peach,       accent: C.coral },
  { id: 'cream-plum',      label: 'Warm Day',         field: C.cream,      text: C.plum,        accent: C.indigo },
  // Cool
  { id: 'teal-cream',      label: 'Teal Deep',        field: C.teal,       text: C.cream,       accent: C.ochre },
  { id: 'slate-ice',       label: 'Slate Calm',       field: C.slate,      text: C.ice,         accent: C.coral },
  // Earth
  { id: 'terracotta-cream',label: 'Terracotta',       field: C.terracotta, text: C.cream,       accent: C.ochre },
  { id: 'moss-cream',      label: 'Moss Ground',      field: C.moss,       text: C.cream,       accent: C.fern },
  // Accent-forward
  { id: 'berry-peach',     label: 'Berry Rich',       field: C.berry,      text: C.peach,       accent: C.coral },
  { id: 'ochre-ink',       label: 'Ochre Bold',       field: C.ochre,      text: C.ink,         accent: C.rust },
  { id: 'sage-ink',        label: 'Sage Soft',        field: C.sage,       text: C.ink,         accent: C.moss },
]

// ── Post type × colorway × alignment matrix ─────────────────────────────────

interface RenderSpec {
  postType: string
  label: string
  layout: string
  headline: string
  category?: string
  subtext?: string
  hasImage: boolean
  textSize: 'sm' | 'md' | 'lg' | 'display'
  colorway: Colorway
  alignment: 'center' | 'left'
}

// Each post type gets 3 colorway variations with mixed alignment
const RENDERS: RenderSpec[] = [
  // Row 1: full-bleed — 3 colorways (alignment irrelevant, image-dominant)
  { postType: 'full-bleed', label: 'Full-Bleed', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: COLORWAYS[2], alignment: 'center' },
  { postType: 'full-bleed', label: 'Full-Bleed', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: COLORWAYS[3], alignment: 'center' },
  { postType: 'full-bleed', label: 'Full-Bleed', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: COLORWAYS[6], alignment: 'center' },

  // Row 2: quote — always center-aligned, 3 color moods
  { postType: 'quote', label: 'Quote', layout: 'type-only', headline: 'Brain fog can mess with your mind, but it won\'t last forever.', subtext: 'DR. KOURTNEY', hasImage: false, textSize: 'md', colorway: COLORWAYS[0], alignment: 'center' },
  { postType: 'quote', label: 'Quote', layout: 'type-only', headline: 'You are not a burden. You are carrying one.', subtext: 'WORDS OF WISDOM', hasImage: false, textSize: 'md', colorway: COLORWAYS[3], alignment: 'center' },
  { postType: 'quote', label: 'Quote', layout: 'type-only', headline: 'The hardest part isn\'t the diagnosis. It\'s the silence around it.', subtext: 'DR. KOURTNEY', hasImage: false, textSize: 'md', colorway: COLORWAYS[7], alignment: 'center' },

  // Row 3: headline + subhead — mix center and left
  { postType: 'headline', label: 'Headline', layout: 'type-only', headline: 'Yes, It\'s Hormones. No, You\'re Not Crazy.', category: 'MENOPAUSE TRUTH', hasImage: false, textSize: 'lg', colorway: COLORWAYS[1], alignment: 'left' },
  { postType: 'headline', label: 'Headline', layout: 'type-only', headline: 'The Happy Truth about Menopause and Metabolism', category: 'WHAT\'S HAPPENING', hasImage: false, textSize: 'lg', colorway: COLORWAYS[4], alignment: 'center' },
  { postType: 'headline', label: 'Headline', layout: 'type-only', headline: 'Every Woman Experiences Menopause Differently', category: 'RESEARCH', hasImage: false, textSize: 'lg', colorway: COLORWAYS[5], alignment: 'left' },

  // Row 4: type poster — mix center and left, display scale
  { postType: 'type-poster', label: 'Type Poster', layout: 'type-only', headline: 'MAKE TIME FOR YOURSELF', hasImage: false, textSize: 'display', colorway: COLORWAYS[2], alignment: 'left' },
  { postType: 'type-poster', label: 'Type Poster', layout: 'type-only', headline: 'GET YOURSELF LOST', hasImage: false, textSize: 'display', colorway: COLORWAYS[8], alignment: 'center' },
  { postType: 'type-poster', label: 'Type Poster', layout: 'type-only', headline: 'KNOW YOUR MENOPAUSE TRIGGERS', hasImage: false, textSize: 'display', colorway: COLORWAYS[6], alignment: 'left' },

  // Row 5: image + text — always left (split layout)
  { postType: 'image-text', label: 'Image + Text', layout: 'split', headline: 'Perimenopause and Hairloss: The Tangled Truth', hasImage: true, textSize: 'lg', colorway: COLORWAYS[0], alignment: 'left' },
  { postType: 'image-text', label: 'Image + Text', layout: 'split', headline: 'What Your Body Is Telling You Right Now', hasImage: true, textSize: 'lg', colorway: COLORWAYS[3], alignment: 'left' },
  { postType: 'image-text', label: 'Image + Text', layout: 'split', headline: 'Sleep, Stress, and the Hormone Connection', hasImage: true, textSize: 'lg', colorway: COLORWAYS[9], alignment: 'left' },

  // Row 6: fact list — left-aligned, informational
  { postType: 'fact-list', label: 'Fact List', layout: 'type-only', headline: 'Hot Flashes\nSnoring\nExtreme Anxiety', category: 'MENOPAUSE FACT', hasImage: false, textSize: 'lg', colorway: COLORWAYS[2], alignment: 'left' },
  { postType: 'fact-list', label: 'Fact List', layout: 'type-only', headline: 'Mood Shifts\nJoint Pain\nBrain Fog', category: 'PERIMENOPAUSE', hasImage: false, textSize: 'lg', colorway: COLORWAYS[5], alignment: 'left' },
  { postType: 'fact-list', label: 'Fact List', layout: 'type-only', headline: 'Community\nResearch\nAdvocacy', category: 'GIVECARE LABS', hasImage: false, textSize: 'lg', colorway: COLORWAYS[8], alignment: 'center' },
]

// ── Placeholder image ────────────────────────────────────────────────────────

function placeholderImage(): Buffer {
  const c = createCanvas(W, H)
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#e8d5c0')
  grad.addColorStop(0.5, '#c9a882')
  grad.addColorStop(1, '#a08060')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#b8956a'
  ctx.beginPath()
  ctx.ellipse(W * 0.6, H * 0.4, W * 0.3, H * 0.25, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d4b896'
  ctx.beginPath()
  ctx.ellipse(W * 0.35, H * 0.65, W * 0.2, H * 0.15, -0.2, 0, Math.PI * 2)
  ctx.fill()
  return c.toBuffer('image/png')
}

// ── Render ────────────────────────────────────────────────────────────────────

const outDir = join(process.cwd(), '..', 'output', 'post-type-preview')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const img = placeholderImage()

function colorwayToProfile(cw: Colorway, alignment: 'center' | 'left'): VisualProfile {
  return {
    id: cw.id,
    field: cw.field,
    text: cw.text,
    accent: cw.accent,
    imageTreatment: 'balanced',
    saturation: 'mid',
    typeWeight: 400,
    typeSize: 'md',
    typeGravity: 'top' as TypeGravity,
    graphicChannels: 2,
    alignment,
  }
}

// Is the field color dark? Simple luminance check for logo color choice.
function isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

async function renderAll() {
  const files: { postType: string; label: string; colorway: string; alignment: string; file: string }[] = []

  for (let i = 0; i < RENDERS.length; i++) {
    const spec = RENDERS[i]
    const dark = isDark(spec.colorway.field)
    const bg: 'dark' | 'light' | 'warm' = dark ? 'dark' : 'warm'
    const renderVisual = { ...visual, background: bg, alignment: spec.alignment as any }
    const layout = computeLayout(spec.layout as any, W, H, renderVisual, `preview-${i}`, `preview-${i}`)
    const profile = colorwayToProfile(spec.colorway, spec.alignment)

    const props: BrandFrameProps = {
      width: W,
      height: H,
      visual: renderVisual,
      layoutName: spec.layout,
      background: bg,
      textSize: spec.textSize as any,
      bgColorIndex: layout.bgColorIndex,
      imageDim: layout.imageDim,
      designProfile: profile,
      imageZone: layout.imageZone,
      textZone: layout.textZone,
      logoZone: layout.logoZone,
      headline: spec.headline,
      category: spec.category,
      subtext: spec.subtext,
      contentImage: spec.hasImage ? img : undefined,
      logoPath: dark ? renderVisual.logo.dark : renderVisual.logo.light,
    }

    const buf = await renderBrandFrame(props)
    const filename = `${spec.postType}-${spec.colorway.id}.png`
    writeFileSync(join(outDir, filename), buf)
    files.push({
      postType: spec.postType,
      label: spec.label,
      colorway: spec.colorway.label,
      alignment: spec.alignment,
      file: filename,
    })
    console.log(`  ${i + 1}/${RENDERS.length} ${spec.postType} × ${spec.colorway.id} (${spec.alignment})`)
  }

  // Group into rows of 3
  const rows: typeof files[] = []
  for (let i = 0; i < files.length; i += 3) {
    rows.push(files.slice(i, i + 3))
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Post Types × Colorways — GiveCare Labs</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e0e0e; color: #eee; font-family: system-ui, sans-serif; padding: 48px; }
  h1 { font-size: 32px; font-weight: 300; margin-bottom: 6px; letter-spacing: 0.02em; }
  .subtitle { color: #777; margin-bottom: 48px; font-size: 14px; }
  .row-label { font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.1em; margin: 32px 0 12px; }
  .row-label:first-of-type { margin-top: 0; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1100px; margin-bottom: 8px; }
  .card { position: relative; border-radius: 8px; overflow: hidden; }
  .card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  .card .overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 12px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); }
  .card .overlay .cw { font-size: 11px; color: rgba(255,255,255,0.7); }
  .card .overlay .align { font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace; }
  .swatches { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 48px; padding: 20px 0; border-bottom: 1px solid #222; }
  .swatch { display: flex; align-items: center; gap: 8px; }
  .swatch .dot { width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); }
  .swatch .name { font-size: 11px; color: #888; }
</style>
</head>
<body>
<h1>Post Types × Colorways</h1>
<p class="subtitle">6 templates, 10 colorways, alignment variation. GiveCare Labs expanded palette.</p>

<div class="swatches">
${COLORWAYS.map(cw => `  <div class="swatch">
    <div class="dot" style="background:${cw.field}"></div>
    <div class="dot" style="background:${cw.text}; width:16px; height:16px;"></div>
    <span class="name">${cw.label}</span>
  </div>`).join('\n')}
</div>

${rows.map((row) => `<div class="row-label">${row[0].label}</div>
<div class="grid">
${row.map(f => `  <div class="card">
    <img src="${f.file}" alt="${f.postType} ${f.colorway}">
    <div class="overlay">
      <div class="cw">${f.colorway}</div>
      <div class="align">${f.alignment}</div>
    </div>
  </div>`).join('\n')}
</div>`).join('\n')}
</body>
</html>`

  writeFileSync(join(outDir, 'index.html'), html)
  console.log(`\n  wrote ${join(outDir, 'index.html')}`)

  const MIME: Record<string, string> = {
    '.html': 'text/html', '.png': 'image/png',
    '.css': 'text/css', '.js': 'text/javascript',
  }

  const server = createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url ?? '/index.html'
    const filePath = join(outDir, url)
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(4174, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:4174'
    console.log(`  serving at ${url}`)
    try { execFileSync('open', [url]) } catch {}
  })
}

renderAll().catch(console.error)
