/**
 * Design system preview: 6 templates × variations per row.
 * Palette: cream / ink / indigo / turmeric. That's it.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { createCanvas, registerFont } from 'canvas'
import { renderBrandFrame } from '../src/composite/renderer/BrandFrame'
import { computeLayout } from '../src/composite/layouts'
import { loadBrandVisual, type VisualProfile, type TypeGravity } from '../src/core/visual'
import type { BrandFrameProps } from '../src/composite/renderer/types'
import { createServer } from 'node:http'
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

const outDir = join(process.cwd(), '..', 'output', 'design-system-preview')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

// ── Palette: 4 colors ────────────────────────────────────────────────────────

const P = {
  cream:    '#FDFBF7',
  ink:      '#1E1B16',
  indigo:   '#5046E5',
  turmeric: '#E5A61B',
}

// ── Colorways ────────────────────────────────────────────────────────────────
// field + text + accent. Turmeric shows up as TEXT or ACCENT, not hidden.

interface Colorway {
  id: string
  label: string
  field: string
  text: string
  accent: string  // used for eyebrow/category color
}

const CW = {
  // Dark field
  inkCream:      { id: 'ink-cream',      label: 'Ink / Cream / Indigo',    field: P.ink,      text: P.cream,    accent: P.indigo   } as Colorway,
  inkTurmeric:   { id: 'ink-turmeric',   label: 'Ink / Turmeric',         field: P.ink,      text: P.turmeric, accent: P.turmeric } as Colorway,
  // Light field
  creamInk:      { id: 'cream-ink',      label: 'Cream / Ink / Indigo',   field: P.cream,    text: P.ink,      accent: P.indigo   } as Colorway,
  creamTurmeric: { id: 'cream-turmeric', label: 'Cream / Ink / Turmeric', field: P.cream,    text: P.ink,      accent: P.turmeric } as Colorway,
  // Accent as field
  indigoField:   { id: 'indigo-field',   label: 'Indigo / Cream',         field: P.indigo,   text: P.cream,    accent: P.turmeric } as Colorway,
  turmericField: { id: 'turmeric-field', label: 'Turmeric / Ink',         field: P.turmeric, text: P.ink,      accent: P.indigo   } as Colorway,
}

// ── Render spec ──────────────────────────────────────────────────────────────

interface RenderSpec {
  id: string
  layout: string
  headline: string
  category?: string
  subtext?: string
  hasImage: boolean
  textSize: 'sm' | 'md' | 'lg' | 'display'
  colorway: Colorway
  alignment: 'center' | 'left'
}

interface RowDef {
  label: string
  description: string
  specs: RenderSpec[]
}

const ROWS: RowDef[] = [
  {
    label: 'Full-Bleed Image',
    description: 'Image fills canvas.',
    specs: [
      { id: 'fb-1', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: CW.creamInk,     alignment: 'center' },
      { id: 'fb-2', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: CW.inkCream,     alignment: 'center' },
      { id: 'fb-3', layout: 'full-bleed', headline: '', hasImage: true, textSize: 'sm', colorway: CW.turmericField, alignment: 'center' },
    ],
  },
  {
    label: 'Quote Card',
    description: 'Centered body text + attribution.',
    specs: [
      { id: 'q-1', layout: 'type-only', headline: 'brain fog can mess with your mind, but it won\'t last forever.', subtext: 'dr. kourtney', hasImage: false, textSize: 'md', colorway: CW.inkCream,     alignment: 'center' },
      { id: 'q-2', layout: 'type-only', headline: 'you are not a burden. you are carrying one.', subtext: 'words of wisdom', hasImage: false, textSize: 'md', colorway: CW.inkTurmeric,  alignment: 'center' },
      { id: 'q-3', layout: 'type-only', headline: 'the hardest part isn\'t the diagnosis. it\'s the silence.', subtext: 'dr. kourtney', hasImage: false, textSize: 'md', colorway: CW.creamInk,     alignment: 'center' },
      { id: 'q-4', layout: 'type-only', headline: 'grief doesn\'t have a timeline. neither does healing.', subtext: 'givecare labs', hasImage: false, textSize: 'md', colorway: CW.indigoField,  alignment: 'center' },
    ],
  },
  {
    label: 'Headline + Subhead',
    description: 'Category eyebrow + headline. Mixed alignment.',
    specs: [
      { id: 'h-1', layout: 'type-only', headline: 'yes, it\'s hormones. no, you\'re not crazy.', category: 'menopause truth', hasImage: false, textSize: 'lg', colorway: CW.inkCream,      alignment: 'left' },
      { id: 'h-2', layout: 'type-only', headline: 'the happy truth about menopause and metabolism', category: 'what\'s happening', hasImage: false, textSize: 'lg', colorway: CW.creamTurmeric, alignment: 'center' },
      { id: 'h-3', layout: 'type-only', headline: 'every woman experiences menopause differently', category: 'research', hasImage: false, textSize: 'lg', colorway: CW.indigoField,   alignment: 'left' },
      { id: 'h-4', layout: 'type-only', headline: 'what caregivers wish you understood', category: 'givecare labs', hasImage: false, textSize: 'lg', colorway: CW.inkTurmeric,  alignment: 'center' },
    ],
  },
  {
    label: 'Type Poster',
    description: 'Display-scale type fills the frame.',
    specs: [
      { id: 'tp-1', layout: 'type-only', headline: 'make time for yourself', hasImage: false, textSize: 'display', colorway: CW.creamInk,      alignment: 'left' },
      { id: 'tp-2', layout: 'type-only', headline: 'get yourself lost',       hasImage: false, textSize: 'display', colorway: CW.inkCream,      alignment: 'center' },
      { id: 'tp-3', layout: 'type-only', headline: 'know your triggers',      hasImage: false, textSize: 'display', colorway: CW.turmericField, alignment: 'left' },
      { id: 'tp-4', layout: 'type-only', headline: 'you are enough',           hasImage: false, textSize: 'display', colorway: CW.inkTurmeric,   alignment: 'center' },
    ],
  },
  {
    label: 'Image + Text',
    description: 'Split: image on one side, headline on the other.',
    specs: [
      { id: 'it-1', layout: 'split', headline: 'perimenopause and hairloss: the tangled truth', hasImage: true, textSize: 'lg', colorway: CW.inkCream,      alignment: 'left' },
      { id: 'it-2', layout: 'split', headline: 'what your body is telling you right now',       hasImage: true, textSize: 'lg', colorway: CW.creamTurmeric, alignment: 'left' },
      { id: 'it-3', layout: 'split', headline: 'sleep, stress, and the hormone connection',     hasImage: true, textSize: 'lg', colorway: CW.indigoField,   alignment: 'left' },
      { id: 'it-4', layout: 'split', headline: 'the science of caregiver burnout',              hasImage: true, textSize: 'lg', colorway: CW.inkTurmeric,   alignment: 'left' },
    ],
  },
  {
    label: 'Fact List',
    description: 'Category label + stacked items.',
    specs: [
      { id: 'fl-1', layout: 'type-only', headline: 'hot flashes\nsnoring\nextreme anxiety', category: 'menopause fact', hasImage: false, textSize: 'lg', colorway: CW.creamInk,      alignment: 'left' },
      { id: 'fl-2', layout: 'type-only', headline: 'mood shifts\njoint pain\nbrain fog',    category: 'perimenopause',  hasImage: false, textSize: 'lg', colorway: CW.inkCream,      alignment: 'left' },
      { id: 'fl-3', layout: 'type-only', headline: 'community\nresearch\nadvocacy',          category: 'givecare labs',  hasImage: false, textSize: 'lg', colorway: CW.turmericField, alignment: 'center' },
      { id: 'fl-4', layout: 'type-only', headline: 'rest\nboundaries\nself-compassion',     category: 'caregiver care', hasImage: false, textSize: 'lg', colorway: CW.creamTurmeric, alignment: 'left' },
    ],
  },
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

const img = placeholderImage()

// ── Profile from colorway ────────────────────────────────────────────────────

function isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

function makeProfile(cw: Colorway, alignment: 'center' | 'left', textSize: string): VisualProfile {
  return {
    id: cw.id,
    field: cw.field,
    text: cw.text,
    accent: cw.accent,
    imageTreatment: 'balanced',
    saturation: 'mid',
    typeWeight: 400,
    typeSize: textSize,  // pass through — don't override
    typeGravity: 'top' as TypeGravity,
    graphicChannels: 2,
    alignment,
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

async function renderAll() {
  const allCards: { row: number; file: string; colorway: string; alignment: string }[] = []
  let total = 0
  for (const row of ROWS) total += row.specs.length

  let count = 0
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r]
    for (const spec of row.specs) {
      count++
      const dark = isDark(spec.colorway.field)
      const bg: 'dark' | 'light' | 'warm' = dark ? 'dark' : 'warm'
      const renderVisual = { ...visual, background: bg, alignment: spec.alignment as any }
      const layout = computeLayout(spec.layout as any, W, H, renderVisual, spec.id, spec.id)
      const profile = makeProfile(spec.colorway, spec.alignment, spec.textSize)

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
      const filename = `${spec.id}.png`
      writeFileSync(join(outDir, filename), buf)
      allCards.push({ row: r, file: filename, colorway: spec.colorway.label, alignment: spec.alignment })
      console.log(`  ${count}/${total} ${spec.id} — ${spec.colorway.label} (${spec.alignment})`)
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Design System — GiveCare Labs</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ddd; font-family: system-ui, -apple-system, sans-serif; padding: 48px 48px 96px; }
  h1 { font-size: 28px; font-weight: 300; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 13px; margin-bottom: 40px; }

  .palette-strip { display: flex; gap: 16px; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 1px solid #1a1a1a; }
  .palette-chip { text-align: center; }
  .palette-dot { width: 48px; height: 48px; border-radius: 8px; margin-bottom: 4px; }
  .palette-name { font-size: 11px; color: #666; }

  .row-section { margin-bottom: 48px; }
  .row-label { font-size: 16px; font-weight: 600; color: #ccc; margin-bottom: 2px; }
  .row-desc { font-size: 12px; color: #555; margin-bottom: 14px; }

  .row-grid { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }
  .card { flex: 0 0 280px; border-radius: 8px; overflow: hidden; position: relative; }
  .card img { width: 280px; height: 280px; object-fit: cover; display: block; }
  .card-meta {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 6px 10px;
    background: linear-gradient(transparent, rgba(0,0,0,0.6));
    display: flex; justify-content: space-between;
  }
  .card-meta span { font-size: 10px; color: rgba(255,255,255,0.6); }
</style>
</head>
<body>
<h1>GiveCare Labs — Design System</h1>
<p class="subtitle">6 templates. 4 colors. Cream / Ink / Indigo / Turmeric.</p>

<div class="palette-strip">
  ${[
    ['Cream', P.cream, 'border: 1px solid rgba(255,255,255,0.1);'],
    ['Ink', P.ink, 'border: 1px solid rgba(255,255,255,0.15);'],
    ['Indigo', P.indigo, ''],
    ['Turmeric', P.turmeric, ''],
  ].map(([name, hex, extra]) =>
    `<div class="palette-chip"><div class="palette-dot" style="background:${hex}; ${extra}"></div><span class="palette-name">${name}</span></div>`
  ).join('')}
</div>

${ROWS.map((row, r) => {
  const cards = allCards.filter(c => c.row === r)
  return `<div class="row-section">
  <div class="row-label">${row.label}</div>
  <div class="row-desc">${row.description}</div>
  <div class="row-grid">
    ${cards.map(c => `<div class="card">
      <img src="${c.file}" alt="${c.colorway}">
      <div class="card-meta"><span>${c.colorway}</span><span>${c.alignment}</span></div>
    </div>`).join('\n    ')}
  </div>
</div>`
}).join('\n')}

</body>
</html>`

  writeFileSync(join(outDir, 'index.html'), html)
  console.log(`\nwrote ${join(outDir, 'index.html')}`)

  const MIME: Record<string, string> = { '.html': 'text/html', '.png': 'image/png' }
  const server = createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url ?? '/index.html'
    const filePath = join(outDir, url)
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      res.end(data)
    } catch { res.writeHead(404); res.end('Not found') }
  })

  server.listen(4174, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:4174'
    console.log(`serving at ${url}`)
    try { execFileSync('open', [url]) } catch {}
  })
}

renderAll().catch(console.error)
