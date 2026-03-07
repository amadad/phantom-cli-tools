/**
 * Visual spectrum command.
 *
 * Sweep brand layout/style permutations and label each one as IN/OUT based on
 * explicit geometric + accessibility checks.
 */

import { ASPECT_RATIOS, type AspectRatio } from '../composite/poster'
import { computeLayout } from '../composite/layouts'
import { extractBrandTopic } from '../cli/args'
import { createCanvas } from 'canvas'
import { execFileSync } from 'child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { extname, isAbsolute, relative, resolve } from 'path'
import { createSessionDir, join, slugify } from '../core/paths'
import {
  type Alignment,
  type Density,
  type VisualProfile,
  imageTreatmentToDim,
  listDesignProfiles,
  type VisualBackground,
  type LayoutName,
  loadBrandVisual
} from '../core/visual'
import { renderBrandFrame } from '../composite/renderer/BrandFrame'
import type { BrandFrameProps } from '../composite/renderer/types'
import type { CommandContext } from '../cli/types'

interface SpectrumRuleConfig {
  minContrast: number
  maxLogoImageOverlap: number
  maxLogoTextOverlap: number
  maxTextImageOverlap: number
  minTextArea: number
  maxTextArea: number
  minImageArea: number
  maxLogoArea: number
}

interface SpectrumCheck {
  name: string
  status: 'pass' | 'fail'
  value: number
  threshold: number
  message: string
}

interface SpectrumPoint {
  id: string
  profile: string
  label: string
  layout: LayoutName
  density: Density
  alignment: Alignment
  background: VisualBackground
  verdict: 'in' | 'out'
  failedChecks: string[]
  checks: SpectrumCheck[]
  metrics: {
    textAreaPct: number
    imageAreaPct: number
    logoAreaPct: number
    textImageOverlapPct: number
    logoImageOverlapPct: number
    logoTextOverlapPct: number
    contrast: number
    fieldColor: string
    textColor: string
  }
}

export interface VisualSpectrumResult {
  brand: string
  ratio: AspectRatio
  topicSeed: string
  totalPoints: number
  accepted: number
  rejected: number
  thresholds: SpectrumRuleConfig
  preview?: {
    outputDir: string
    indexPath: string
    annotationsPath: string
    count: number
    points: Array<{
      profile: string
      id: string
      label: string
      fileName: string
      verdict: 'in' | 'out'
      failedChecks: string[]
      manual: ManualLabel
    }>
  }
  points: SpectrumPoint[]
}

type DesignProfileCandidate = {
  id: string
  profile: VisualProfile | null
}

type ManualLabel = 'unrated' | 'in' | 'out'

type PreviewPointMeta = {
  profile: string
  id: string
  label: string
  fileName: string
  verdict: 'in' | 'out'
  failedChecks: string[]
  manual: ManualLabel
}

interface ParserFlags {
  ratio?: string
  seed?: string
  profiles?: string
  profile?: string
  layouts?: string
  density?: string
  alignment?: string
  background?: string
  minContrast?: string
  maxLogoImageOverlap?: string
  maxLogoTextOverlap?: string
  maxTextImageOverlap?: string
  minTextArea?: string
  maxTextArea?: string
  minImageArea?: string
  maxLogoArea?: string
  render?: string
  renderLimit?: string
  renderDir?: string
  renderHeadline?: string
  serve?: string
  servePort?: string
}

const VALID_LAYOUTS: LayoutName[] = ['split', 'overlay', 'type-only', 'card', 'full-bleed']
const VALID_DENSITY: Density[] = ['relaxed', 'moderate', 'tight']
const VALID_ALIGNMENT: Alignment[] = ['center', 'left', 'asymmetric']
const VALID_BACKGROUND: VisualBackground[] = ['light', 'dark', 'warm']

const DEFAULT_RULES: SpectrumRuleConfig = {
  minContrast: 4.5,
  maxLogoImageOverlap: 0.08,
  maxLogoTextOverlap: 0.05,
  maxTextImageOverlap: 0.6,
  minTextArea: 0.03,
  maxTextArea: 0.65,
  minImageArea: 0.14,
  maxLogoArea: 0.18,
}

const DEFAULT_RENDER_LIMIT = 24
const DEFAULT_SERVE_PORT = 4173

function splitList(raw: string | undefined): string[] {
  return raw
    ? raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
    : []
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

function parsePortOr(value: string | undefined, fallback: number): number {
  const parsed = parseIntOr(value, fallback)
  if (parsed < 1 || parsed > 65535) return fallback
  return parsed
}

function guessContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.html') return 'text/html; charset=utf-8'
  if (extension === '.json') return 'application/json; charset=utf-8'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.css') return 'text/css; charset=utf-8'
  if (extension === '.js') return 'application/javascript; charset=utf-8'
  if (extension === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

function isManualLabel(value: unknown): value is ManualLabel {
  return value === 'in' || value === 'out' || value === 'unrated'
}

function updateAnnotationManualLabel(annotationsPath: string, pointId: string, manual: ManualLabel): boolean {
  if (!existsSync(annotationsPath)) return false

  try {
    const payload = JSON.parse(readFileSync(annotationsPath, 'utf8'))
    if (!Array.isArray(payload.points)) return false

    let changed = false
    const nextPoints = payload.points.map((entry: { id?: string; manual?: ManualLabel }) => {
      if (entry?.id !== pointId) return entry
      changed = true
      return { ...entry, manual }
    })

    if (!changed) return false
    payload.points = nextPoints
    payload.createdAt = new Date().toISOString()
    writeFileSync(annotationsPath, JSON.stringify(payload, null, 2), 'utf8')
    console.log(`[visual] feedback ${pointId} -> ${manual}`)
    return true
  } catch {
    return false
  }
}

const MAX_BODY_BYTES = 4096

function readBodyText(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk.toString('utf8')
      if (raw.length > MAX_BODY_BYTES) {
        request.destroy()
        reject(new Error('Request body too large'))
      }
    })
    request.on('error', reject)
    request.on('end', () => resolve(raw))
  })
}

async function startPreviewServer(rootDir: string, preferredPort: number): Promise<{ port: number; close: () => Promise<void> }> {
  const servePath = resolve(rootDir)
  const annotationsPath = resolve(servePath, 'annotations.json')
  const handler = (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => {
    if (!request.url) {
      response.writeHead(400)
      response.end('Bad request')
      return
    }

    let targetPath = '/'
    try {
      targetPath = new URL(request.url, 'http://127.0.0.1').pathname
    } catch {
      response.writeHead(400)
      response.end('Bad request')
      return
    }

    if (request.method === 'POST' && targetPath === '/__feedback') {
      void (async () => {
        try {
          const bodyRaw = await readBodyText(request)
          const body = JSON.parse(bodyRaw || '{}')
          const pointId = typeof body.pointId === 'string' ? body.pointId.trim() : ''
          const manual = body.manual
          if (!pointId || !isManualLabel(manual)) {
            response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
            response.end(JSON.stringify({ ok: false, error: 'Invalid payload' }))
            return
          }

          const ok = updateAnnotationManualLabel(annotationsPath, pointId, manual)
          if (!ok) {
            response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
            response.end(JSON.stringify({ ok: false, error: 'Unknown point id' }))
            return
          }

          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ ok: true }))
        } catch {
          response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ ok: false, error: 'Unable to update annotations' }))
        }
      })()
      return
    }

    const normalized = (targetPath === '/' ? '/index.html' : targetPath.split('?')[0]).replace(/^\/+/, '')
    const safeTarget = resolve(servePath, decodeURIComponent(normalized))
    const relativePath = relative(servePath, safeTarget)

    if (isAbsolute(relativePath) || relativePath.startsWith('..')) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    if (!existsSync(safeTarget) || !statSync(safeTarget).isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    try {
      const content = readFileSync(safeTarget)
      const contentType = guessContentType(safeTarget)
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content)
    } catch {
      response.writeHead(500)
      response.end('Server error')
    }
  }

  const server = createServer(handler)
  const tryListen = (candidatePort: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' && candidatePort < 65535) {
          server.removeAllListeners('error')
          server.removeAllListeners('listening')
          tryListen(candidatePort + 1).then(resolve).catch(reject)
          return
        }
        reject(error)
      }

      const onListening = () => {
        server.removeListener('error', onError)
        resolve(candidatePort)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(candidatePort, '127.0.0.1')
    })
  }

  const port = await tryListen(preferredPort)
  return {
    port,
    close: async () => new Promise((resolve) => {
      server.close(() => resolve())
    }),
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  return Math.min(1, value)
}

function safeFileName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized.length > 0 ? normalized : 'point'
}

function clampHeadline(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value
  return `${value.slice(0, maxLen - 1)}…`
}

const placeholderCache = new Map<string, Buffer>()

function buildPlaceholderImage(width: number, height: number): Buffer {
  const key = `${width}x${height}`
  const cached = placeholderCache.get(key)
  if (cached) return cached

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const base = '#f0ece2'
  const accent = '#d4c9b0'
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, base)
  grad.addColorStop(1, accent)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#c6b79d'
  ctx.fillRect(0, Math.round(height * 0.62), width, Math.round(height * 0.18))
  ctx.fillStyle = '#d3d3d3'
  ctx.fillRect(width * 0.05, height * 0.15, width * 0.9, height * 0.35)

  ctx.fillStyle = '#9e9683'
  ctx.font = `${Math.max(24, Math.round(Math.min(width, height) * 0.08))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Placeholder image', width / 2, height / 2)

  const buffer = canvas.toBuffer('image/png')
  placeholderCache.set(key, buffer)
  return buffer
}

function openInBrowser(target: string): void {
  try {
    if (process.platform === 'darwin') {
      execFileSync('open', [target])
    } else if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', target])
    } else {
      execFileSync('xdg-open', [target])
    }
  } catch (error: unknown) {
    console.log(`[visual] Unable to open browser automatically: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`[visual] Open manually: ${target}`)
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;'
    if (character === '<') return '&lt;'
    if (character === '>') return '&gt;'
    if (character === '"') return '&quot;'
    return '&#39;'
  })
}

function intersectionArea(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const left = Math.max(a.x, b.x)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const top = Math.max(a.y, b.y)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (left >= right || top >= bottom) return 0
  return (right - left) * (bottom - top)
}

function zoneArea(zone: { width: number; height: number }): number {
  if (zone.width <= 0 || zone.height <= 0) return 0
  return zone.width * zone.height
}

function toRatio(num: number, den: number): number {
  return den <= 0 ? 0 : clamp01(num / den)
}

interface RGB {
  r: number
  g: number
  b: number
}

function parseHexColor(raw: string): RGB | null {
  const value = raw.trim().replace('#', '')
  if (!/^[0-9a-fA-F]+$/.test(value)) return null
  if (![3, 4, 6, 8].includes(value.length)) return null

  const short = value.length === 3 || value.length === 4
  const expanded = short
    ? value.slice(0, 3).split('').map((ch) => ch + ch).join('')
    : value.slice(0, 6)

  if (expanded.length < 6) return null

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

function srgbToLinear(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(color: RGB): number {
  return 0.2126 * srgbToLinear(color.r) + 0.7152 * srgbToLinear(color.g) + 0.0722 * srgbToLinear(color.b)
}

function contrastRatio(a: string, b: string): number {
  const left = parseHexColor(a)
  const right = parseHexColor(b)
  if (!left || !right) return 0

  const luminance1 = luminance(left)
  const luminance2 = luminance(right)
  const brightest = Math.max(luminance1, luminance2)
  const darkest = Math.min(luminance1, luminance2)
  return (brightest + 0.05) / (darkest + 0.05)
}

function validateRatio(value: string | undefined): AspectRatio {
  const normalized = (value ?? 'landscape').toLowerCase().trim()
  if (!(normalized in ASPECT_RATIOS)) {
    throw new Error(`Invalid --ratio "${normalized}". Supported: ${Object.keys(ASPECT_RATIOS).join(', ')}`)
  }
  return normalized as AspectRatio
}

function validateEnumList<T extends string>(raw: string[] | undefined, allowed: ReadonlyArray<T>, label: string): T[] {
  if (!raw || raw.length === 0) return [...allowed]
  const uniq = [...new Set(raw)]
  const unknown = uniq.filter((value) => !allowed.includes(value as T))
  if (unknown.length > 0) {
    throw new Error(`Unknown ${label}: ${unknown.join(', ')}`)
  }
  return uniq as T[]
}

function parseProfilesFilter(raw: string[] | undefined, available: string[]): string[] {
  if (!raw || raw.length === 0) return available
  const normalized = [...new Set(raw.map((entry) => entry.toLowerCase()))]
  const unknown = normalized.filter((value) => !available.includes(value))
  if (unknown.length > 0) {
    throw new Error(`Unknown profiles: ${unknown.join(', ')}`)
  }
  return normalized
}

const DASHED_ALIASES: Record<string, keyof ParserFlags> = {
  'min-contrast': 'minContrast',
  'max-logo-image-overlap': 'maxLogoImageOverlap',
  'max-logo-text-overlap': 'maxLogoTextOverlap',
  'max-text-image-overlap': 'maxTextImageOverlap',
  'min-text-area': 'minTextArea',
  'max-text-area': 'maxTextArea',
  'min-image-area': 'minImageArea',
  'max-logo-area': 'maxLogoArea',
  'render-limit': 'renderLimit',
  'render-dir': 'renderDir',
  'render-headline': 'renderHeadline',
  'serve-port': 'servePort',
}

function canonicalizeFlags(flags: Record<string, string>): ParserFlags {
  const canonical: ParserFlags = { ...flags }

  for (const [rawKey, canonicalKey] of Object.entries(DASHED_ALIASES)) {
    const value = flags[rawKey]
    if (value !== undefined) {
      canonical[canonicalKey] = value
    }
  }

  return canonical
}

function parseFlags(flags: ParserFlags): SpectrumRuleConfig {
  return {
    minContrast: parseNumber(flags.minContrast, DEFAULT_RULES.minContrast),
    maxLogoImageOverlap: parseNumber(flags.maxLogoImageOverlap, DEFAULT_RULES.maxLogoImageOverlap),
    maxLogoTextOverlap: parseNumber(flags.maxLogoTextOverlap, DEFAULT_RULES.maxLogoTextOverlap),
    maxTextImageOverlap: parseNumber(flags.maxTextImageOverlap, DEFAULT_RULES.maxTextImageOverlap),
    minTextArea: parseNumber(flags.minTextArea, DEFAULT_RULES.minTextArea),
    maxTextArea: parseNumber(flags.maxTextArea, DEFAULT_RULES.maxTextArea),
    minImageArea: parseNumber(flags.minImageArea, DEFAULT_RULES.minImageArea),
    maxLogoArea: parseNumber(flags.maxLogoArea, DEFAULT_RULES.maxLogoArea),
  }
}

function evaluatePoint(
  visual: ReturnType<typeof loadBrandVisual>,
  profileId: string,
  layoutName: LayoutName,
  density: Density,
  alignment: Alignment,
  background: VisualBackground,
  ratio: AspectRatio,
  seed: string,
  profile: VisualProfile | null,
  rules: SpectrumRuleConfig,
): SpectrumPoint {
  const renderVisual = {
    ...visual,
    density,
    alignment,
    background,
  }
  const { width, height } = ASPECT_RATIOS[ratio]
  const layout = computeLayout(layoutName, width, height, renderVisual, seed, seed)

  const totalArea = width * height
  const textArea = zoneArea(layout.textZone)
  const imageArea = zoneArea(layout.imageZone)
  const logoArea = zoneArea(layout.logoZone)

  const textImageOverlap = intersectionArea(layout.textZone, layout.imageZone)
  const logoImageOverlap = intersectionArea(layout.logoZone, layout.imageZone)
  const logoTextOverlap = intersectionArea(layout.logoZone, layout.textZone)

  const textColor = profile?.text ?? renderVisual.palette.primary
  const fieldColor = profile?.field ?? renderVisual.palette.background

  const checks: SpectrumCheck[] = []

  const addCheck = (
    name: string,
    pass: boolean,
    value: number,
    threshold: number,
    message: string,
  ) => {
    checks.push({
      name,
      status: pass ? 'pass' : 'fail',
      value,
      threshold,
      message,
    })
  }

  const contrast = contrastRatio(textColor, fieldColor)
  addCheck(
    'contrast',
    contrast >= rules.minContrast,
    contrast,
    rules.minContrast,
    `Text contrast vs field: ${contrast.toFixed(2)} (min ${rules.minContrast.toFixed(2)})`,
  )

  const textAreaPct = toRatio(textArea, totalArea)
  const textTooSmall = textAreaPct < rules.minTextArea
  addCheck(
    'text-coverage',
    textAreaPct >= rules.minTextArea && textAreaPct <= rules.maxTextArea,
    textAreaPct,
    textTooSmall ? rules.minTextArea : rules.maxTextArea,
    `Text area: ${(textAreaPct * 100).toFixed(1)}% (window ${(
      rules.minTextArea * 100
    ).toFixed(1)}-${(rules.maxTextArea * 100).toFixed(1)}%)`,
  )

  if (layout.imageZone.width > 0 && layout.imageZone.height > 0) {
    const imageAreaPct = toRatio(imageArea, totalArea)
    addCheck(
      'image-coverage',
      imageAreaPct >= rules.minImageArea,
      imageAreaPct,
      rules.minImageArea,
      `Image area: ${(imageAreaPct * 100).toFixed(1)}% (min ${(rules.minImageArea * 100).toFixed(1)}%)`,
    )
  }

  const logoAreaPct = toRatio(logoArea, totalArea)
  addCheck(
    'logo-coverage',
    logoAreaPct <= rules.maxLogoArea,
    logoAreaPct,
    rules.maxLogoArea,
    `Logo area: ${(logoAreaPct * 100).toFixed(1)}% (max ${(rules.maxLogoArea * 100).toFixed(1)}%)`,
  )

  const logoImageOverlapPct = imageArea > 0 ? toRatio(logoImageOverlap, imageArea) : 0
  addCheck(
    'logo-image-overlap',
    logoImageOverlapPct <= rules.maxLogoImageOverlap,
    logoImageOverlapPct,
    rules.maxLogoImageOverlap,
    `Logo-image overlap: ${(logoImageOverlapPct * 100).toFixed(1)}% (max ${(rules.maxLogoImageOverlap * 100).toFixed(1)}%)`,
  )

  const logoTextOverlapPct = textArea > 0 ? toRatio(logoTextOverlap, textArea) : 0
  addCheck(
    'logo-text-overlap',
    logoTextOverlapPct <= rules.maxLogoTextOverlap,
    logoTextOverlapPct,
    rules.maxLogoTextOverlap,
    `Logo-text overlap: ${(logoTextOverlapPct * 100).toFixed(1)}% (max ${(rules.maxLogoTextOverlap * 100).toFixed(1)}%)`,
  )

  const textImageOverlapPct = textArea > 0 ? toRatio(textImageOverlap, textArea) : 0
  if (layout.imageZone.width > 0 && layout.imageZone.height > 0) {
    addCheck(
      'text-image-overlap',
      textImageOverlapPct <= rules.maxTextImageOverlap,
      textImageOverlapPct,
      rules.maxTextImageOverlap,
      `Text-image overlap: ${(textImageOverlapPct * 100).toFixed(1)}% (max ${(rules.maxTextImageOverlap * 100).toFixed(1)}%)`,
    )
  }

  const accepted = checks.every((check) => check.status === 'pass')
  const failedChecks = checks.filter((check) => check.status === 'fail').map((check) => check.name)

  return {
    id: `${profileId}:${layoutName}:${density}:${alignment}:${background}`,
    label: `${profileId} | ${layoutName} | ${density} | ${alignment} | ${background}`,
    profile: profileId,
    layout: layoutName,
    density,
    alignment,
    background,
    verdict: accepted ? 'in' : 'out',
    failedChecks,
    checks,
    metrics: {
      textAreaPct,
      imageAreaPct: toRatio(imageArea, totalArea),
      logoAreaPct,
      textImageOverlapPct,
      logoImageOverlapPct,
      logoTextOverlapPct,
      contrast,
      fieldColor,
      textColor,
    },
  }
}

function resolveRenderDir(brand: string, ratio: AspectRatio, seed: string, rawDir?: string): string {
  if (!rawDir) {
    const fallbackSeed = slugify(seed, 20) || 'spectrum'
    return createSessionDir(`visual-${brand}-${ratio}`, `-${fallbackSeed}`)
  }

  const normalized = rawDir.trim()
  if (!normalized) return createSessionDir(`visual-${brand}-${ratio}`, `-${slugify(seed, 12)}`)

  const isWinAbs = /^[A-Za-z]:[\\/]/.test(normalized)
  const isPosixAbs = normalized.startsWith('/')
  const resolved = (isWinAbs || isPosixAbs) ? normalized : join(process.cwd(), normalized)
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true })
  }
  return resolved
}

async function renderSpectrumPoint(
  visual: ReturnType<typeof loadBrandVisual>,
  point: SpectrumPoint,
  ratio: AspectRatio,
  designProfile: VisualProfile | null | undefined,
  headlinePrefix?: string,
): Promise<Buffer> {
  const { width, height } = ASPECT_RATIOS[ratio]
  const renderVisual = {
    ...visual,
    density: point.density,
    alignment: point.alignment,
    background: point.background,
  }
  const seed = `spectrum:${point.id}`
  const layout = computeLayout(point.layout, width, height, renderVisual, seed, seed)

  // Profile overrides layout defaults for composition axes
  const resolvedImageDim = designProfile?.imageTreatment
    ? imageTreatmentToDim(designProfile.imageTreatment)
    : layout.imageDim

  const frameProps: BrandFrameProps = {
    width,
    height,
    visual: renderVisual,
    layoutName: point.layout,
    background: layout.background,
    textSize: layout.textSize,
    bgColorIndex: layout.bgColorIndex,
    imageDim: resolvedImageDim,
    designProfile: designProfile ?? undefined,
    typeGravity: designProfile?.typeGravity,
    imageZone: layout.imageZone,
    textZone: layout.textZone,
    logoZone: layout.logoZone,
    headline: clampHeadline(headlinePrefix ? `${headlinePrefix} | ${point.label}` : point.label, 90),
    logoPath: renderVisual.background === 'dark' ? renderVisual.logo.dark : renderVisual.logo.light,
  }

  const hasImage = layout.imageZone.width > 0 && layout.imageZone.height > 0
  if (hasImage) {
    frameProps.contentImage = buildPlaceholderImage(width, height)
  }

  return renderBrandFrame(frameProps)
}

function buildPreviewIndex(args: {
  brand: string
  ratio: AspectRatio
  annotationsPath: string
  annotationsCreatedAt: string
  enableLiveRefresh: boolean
  points: PreviewPointMeta[]
}): string {
  const liveRefreshScript = args.enableLiveRefresh
    ? `
      let annotationsPath = 'annotations.json'
      const storageKey = ${JSON.stringify(`phantom-visual-spectrum:${args.brand}:${args.ratio}:${args.annotationsCreatedAt}`)}
      let annotationsCreatedAt = ${JSON.stringify(args.annotationsCreatedAt)}

      loadManualOverrides = () => {
        try {
          const storedRaw = window.localStorage.getItem(storageKey)
          if (!storedRaw) return
          const stored = JSON.parse(storedRaw)
          if (!stored || typeof stored !== 'object') return
          points.forEach((point, index) => {
            const value = stored[point.id]
            if (value === 'in' || value === 'out' || value === 'unrated') {
              manual[index] = value
            }
          })
        } catch {}
      }

      saveManualOverrides = () => {
        try {
          const payload = {}
          points.forEach((point, index) => {
            payload[point.id] = manual[index]
          })
          window.localStorage.setItem(storageKey, JSON.stringify(payload))
        } catch {}
      }

      const pollAnnotations = async () => {
        try {
          const response = await fetch(annotationsPath + '?t=' + Date.now(), { cache: 'no-store' })
          if (!response.ok) return
          const latest = await response.json()
          if (latest?.createdAt && latest.createdAt !== annotationsCreatedAt) {
            annotationsCreatedAt = latest.createdAt
            if (Array.isArray(latest.points)) {
              latest.points.forEach((sp) => {
                const idx = points.findIndex((p) => p.id === sp.id)
                if (idx >= 0 && sp.manual && sp.manual !== manual[idx]) {
                  applyManual(idx, sp.manual)
                }
              })
              renderSummary()
            }
          }
        } catch {}
      }
      setInterval(pollAnnotations, 2500)
    `
    : ''

  const cards = args.points.map((point, index) => {
    const checks = point.failedChecks.length > 0
      ? point.failedChecks.join(', ')
      : 'none'
    const mark = point.verdict === 'in' ? 'in' : 'out'
    return `
      <article class="card ${point.verdict}" data-point-index="${index}" data-verdict="${point.verdict}" data-point-id="${escapeHtml(point.id)}">
        <img src="${escapeHtml(point.fileName)}" alt="${escapeHtml(point.label)}" />
        <div class="meta">
          <div class="meta-head">
            <h3>#${index + 1} ${escapeHtml(point.label)}</h3>
            <span class="status ${point.verdict}">${mark}</span>
          </div>
          <p class="profile">profile: ${escapeHtml(point.profile)}</p>
          <p>id: ${escapeHtml(point.id)}</p>
          <p>failed checks: ${escapeHtml(checks)}</p>
          <p class="manual-line">
            manual:
            <span class="manual-label" data-manual-for="${index}">unrated</span>
          </p>
          <div class="actions">
            <button type="button" data-action="manual" data-value="in" data-index="${index}" data-point-id="${escapeHtml(point.id)}">👍 Keep</button>
            <button type="button" data-action="manual" data-value="out" data-index="${index}" data-point-id="${escapeHtml(point.id)}">👎 Skip</button>
            <button type="button" data-action="manual" data-value="unrated" data-index="${index}" data-point-id="${escapeHtml(point.id)}">↺ Reset</button>
          </div>
        </div>
      </article>`
  }).join('\n')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(`Visual spectrum preview — ${args.brand}`)}</title>
    <style>
      :root { font-family: Arial, Helvetica, sans-serif; background: #f6f4ee; color: #26231d; }
      body { margin: 24px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      .subtitle { margin: 0 0 12px; color: #5a544d; }
      .toolbar { margin: 12px 0 16px; display: flex; gap: 10px; flex-wrap: wrap; }
      .toolbar button { border: 1px solid #b9b3a8; background: #fff; border-radius: 999px; padding: 8px 12px; }
      .toolbar button[data-filter][aria-pressed="true"] { background: #1f2937; color: #fff; border-color: #1f2937; }
      .status, .manual-label { font-weight: 700; }
      .status.in, .manual-label.in { color: #1d7d33; }
      .status.out, .manual-label.out { color: #a52d2d; }
      .manual-label.unrated { color: #615b53; }
      .gallery { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit,minmax(320px, 1fr)); }
      .card { border: 1px solid #ddd2be; border-radius: 12px; background: white; overflow: hidden; }
      .card img { width: 100%; height: auto; display: block; background: #d8d3c8; }
      .meta { padding: 10px 12px; }
      .meta h3 { margin: 0 0 6px; font-size: 13px; }
      .meta p { margin: 4px 0; font-size: 12px; color: #5a544d; word-break: break-word; }
      .meta-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .meta-head h3 { margin: 0; }
      .status { font-size: 12px; text-transform: uppercase; }
      .actions { display: flex; gap: 6px; margin-top: 10px; }
      .actions button { border: 1px solid #b9b3a8; background: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
      .actions button[data-value="in"] { border-color: #9fd3a4; }
      .actions button[data-value="out"] { border-color: #e7a1a1; }
      .actions button[data-value="unrated"] { border-color: #b7b2a9; }
      .card.hidden { display: none; }
      .summary { display: flex; gap: 16px; margin: 12px 0; color: #5a544d; font-size: 13px; flex-wrap: wrap; }
      textarea { width: min(100%, 700px); min-height: 120px; border-radius: 8px; border: 1px solid #ddd2be; padding: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
      .muted { color: #7a7169; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(`${args.brand} (${args.ratio}) spectrum preview`)}</h1>
    <p class="subtitle">Review points and save your labels for design-space learning.</p>
    <p class="subtitle">Annotations file to keep: <code>${escapeHtml(args.annotationsPath)}</code></p>
    <div class="toolbar">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="auto-in" aria-pressed="false">Auto in</button>
      <button type="button" data-filter="auto-out" aria-pressed="false">Auto out</button>
      <button type="button" data-filter="manual-in" aria-pressed="false">Manual keep</button>
      <button type="button" data-filter="manual-out" aria-pressed="false">Manual skip</button>
      <button type="button" data-filter="manual-unrated" aria-pressed="false">Manual unrated</button>
      <button type="button" id="copy-json">Copy labeled JSON</button>
      <button type="button" id="download-json">Download labels</button>
    </div>
    <div class="summary">
      <span id="summary-total"></span>
      <span id="summary-keep"></span>
      <span id="summary-skip"></span>
      <span id="summary-unrated"></span>
    </div>
    <div id="gallery" class="gallery">
      ${cards}
    </div>
    <div style="margin-top:14px;">
      <p class="muted">Use Copy or Download to store manual labels as JSON.</p>
      <textarea id="payload" readonly></textarea>
    </div>
    <script>
      const points = ${JSON.stringify(args.points)}
      const manual = points.map((point) => point.manual ?? 'unrated')
      const summaryTotal = document.getElementById('summary-total')
      const summaryKeep = document.getElementById('summary-keep')
      const summarySkip = document.getElementById('summary-skip')
      const summaryUnrated = document.getElementById('summary-unrated')
      const payload = document.getElementById('payload')
      let saveManualOverrides = () => {}
      let loadManualOverrides = () => {}
      const buttons = document.querySelectorAll('[data-filter]')
      const cards = document.querySelectorAll('#gallery .card')
      const setFilterPressed = (active) => {
        buttons.forEach((filterButton) => {
          if (filterButton.dataset.filter) {
            filterButton.setAttribute('aria-pressed', String(filterButton === active))
          }
        })
      }

      const renderSummary = () => {
        const manualIn = manual.filter((value) => value === 'in').length
        const manualOut = manual.filter((value) => value === 'out').length
        const manualUnrated = manual.filter((value) => value === 'unrated').length

        summaryTotal.textContent = 'Rendered: ' + points.length
        summaryKeep.textContent = 'Manual keep: ' + manualIn
        summarySkip.textContent = 'Manual skip: ' + manualOut
        summaryUnrated.textContent = 'Unrated: ' + manualUnrated

        payload.value = JSON.stringify(
          {
            schema: 'phantom-visual-spectrum-review-v1',
            createdAt: new Date().toISOString(),
            brand: ${JSON.stringify(args.brand)},
            ratio: ${JSON.stringify(args.ratio)},
            points: points.map((point, index) => ({
              id: point.id,
              profile: point.profile,
              verdict: point.verdict,
              manual: manual[index],
              failedChecks: point.failedChecks,
            })),
          },
          null,
          2
        )
      }

      const postManualLabel = async (pointId, value) => {
        try {
          const response = await fetch('/__feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ pointId, manual: value }),
          })
          if (!response.ok) {
            console.warn('Failed to persist feedback to CLI')
          }
        } catch {
          console.warn('Unable to contact feedback endpoint')
        }
      }

      const applyManual = (index, value) => {
        manual[index] = value
        const card = document.querySelector('article[data-point-index="' + index + '"]')
        if (!card) return
        const label = card.querySelector('[data-manual-for="' + index + '"]')
        if (!label) return
        label.textContent = value
        label.classList.remove('in', 'out', 'unrated')
        label.classList.add(value)
        saveManualOverrides()
      }

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const filter = button.dataset.filter
          if (!filter) return
          if (['all', 'auto-in', 'auto-out', 'manual-in', 'manual-out', 'manual-unrated'].includes(filter)) {
            setFilterPressed(button)
          }

          cards.forEach((card) => {
            const auto = card.dataset.verdict === 'in'
            const index = Number(card.dataset.pointIndex || 0)
            if (filter === 'all') {
              card.classList.remove('hidden')
              return
            }
            if (filter === 'auto-in') {
              card.classList.toggle('hidden', !auto)
              return
            }
            if (filter === 'auto-out') {
              card.classList.toggle('hidden', auto)
              return
            }
            const state = manual[index]
            if (filter === 'manual-in') {
              card.classList.toggle('hidden', state !== 'in')
              return
            }
            if (filter === 'manual-out') {
              card.classList.toggle('hidden', state !== 'out')
              return
            }
            card.classList.toggle('hidden', state !== 'unrated')
          })
        })
      })

      document.querySelectorAll('[data-action="manual"]').forEach((button) => {
        button.addEventListener('click', async (event) => {
          const target = event.currentTarget
          const index = Number(target.dataset.index || 0)
          const value = target.dataset.value
          const pointId = target.dataset.pointId
          if (!value) return
          applyManual(index, value)
          renderSummary()
          await postManualLabel(pointId, value)
        })
      })

      document.getElementById('copy-json').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(payload.value)
          window.alert('Manual labels copied')
        } catch (error) {
          window.alert('Copy failed. Use Download instead.')
        }
      })

      document.getElementById('download-json').addEventListener('click', () => {
        const blob = new Blob([payload.value], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'visual-spectrum-review.json'
        anchor.click()
        URL.revokeObjectURL(url)
      })

      ${args.enableLiveRefresh ? 'loadManualOverrides()' : ''}
      manual.forEach((value, index) => applyManual(index, value))
      renderSummary()
      saveManualOverrides()
      ${liveRefreshScript}
    </script>
  </body>
</html>`
}

export async function run(args: string[], _ctx?: CommandContext): Promise<VisualSpectrumResult> {
  const [subcommand, ...remaining] = args
  if (subcommand !== 'spectrum') {
    throw new Error('Usage: visual spectrum <brand> [options]')
  }

  const parsed = extractBrandTopic(remaining, [
    'ratio',
    'seed',
    'profiles',
    'profile',
    'layouts',
    'density',
    'alignment',
    'background',
    'render-limit',
    'render-dir',
    'render-headline',
    'min-contrast',
    'max-logo-image-overlap',
    'max-logo-text-overlap',
    'max-text-image-overlap',
    'min-text-area',
    'max-text-area',
    'min-image-area',
    'max-logo-area',
    'serve-port',
  ], [
    'no-image',
    'json',
    'render',
    'open',
    'serve',
  ])

  const brand = parsed.brand
  const parsedFlags = canonicalizeFlags(parsed.flags)
  const rules = parseFlags(parsedFlags)
  const ratio = validateRatio(parsedFlags.ratio)
  const layoutFilter = validateEnumList(splitList(parsedFlags.layouts), VALID_LAYOUTS, 'layouts')
  const densityFilter = validateEnumList(splitList(parsedFlags.density), VALID_DENSITY, 'densities')
  const alignmentFilter = validateEnumList(splitList(parsedFlags.alignment), VALID_ALIGNMENT, 'alignments')
  const backgroundFilter = validateEnumList(splitList(parsedFlags.background), VALID_BACKGROUND, 'backgrounds')

  const visual = loadBrandVisual(brand)
  const profileItems = listDesignProfiles(brand)
  const availableProfiles: DesignProfileCandidate[] = profileItems.length > 0
    ? profileItems.map((item): DesignProfileCandidate => ({ id: item.id, profile: item.profile }))
    : [{ id: 'base', profile: null }]
  const availableProfileIds = availableProfiles.map((item) => item.id.toLowerCase())

  const profileFilters = splitList(parsedFlags.profiles ?? parsedFlags.profile)
  const selectedProfiles = parseProfilesFilter(profileFilters, availableProfileIds)
  const filteredProfiles = availableProfiles.filter(
    (item) => selectedProfiles.includes(item.id.toLowerCase()),
  )

  const points: SpectrumPoint[] = []
  const noImage = parsed.booleans.has('no-image')
  const serve = parsed.booleans.has('serve')
  const shouldRender = parsed.booleans.has('render') || serve
  const servePort = parsePortOr(parsedFlags.servePort, DEFAULT_SERVE_PORT)
  const seed = parsedFlags.seed ?? `${brand}:spectrum`

  const baseVisual = visual
  const targetLayouts = noImage ? ['type-only'] as const : layoutFilter

  for (const profileItem of filteredProfiles) {
    const profile = profileItem.profile

    const densities = profile?.density ? [profile.density] : densityFilter
    const alignments = profile?.alignment ? [profile.alignment] : alignmentFilter
    const backgrounds = profile?.background ? [profile.background] : backgroundFilter

    for (const layout of targetLayouts) {
      for (const density of densities) {
        for (const alignment of alignments) {
          for (const background of backgrounds) {
            const renderVisual = { ...baseVisual, density, alignment, background }
            const point = evaluatePoint(
              renderVisual as ReturnType<typeof loadBrandVisual>,
              profileItem.id,
              layout,
              density,
              alignment,
              background,
              ratio,
              `${seed}:${profileItem.id}:${layout}:${density}:${alignment}:${background}`,
              profile,
              rules,
            )
            points.push(point)
          }
        }
      }
    }
  }

  const accepted = points.filter((point) => point.verdict === 'in').length
  const rejected = points.length - accepted

  const sorted = points.sort((a, b) => {
    if (a.verdict === b.verdict) return a.id.localeCompare(b.id)
    return a.verdict === 'in' ? -1 : 1
  })

  const profileById = new Map<string, VisualProfile | null>()
  for (const profileItem of filteredProfiles) {
    profileById.set(profileItem.id, profileItem.profile)
  }

  let preview: VisualSpectrumResult['preview']
  if (shouldRender) {
    const renderLimit = parseIntOr(parsedFlags.renderLimit, DEFAULT_RENDER_LIMIT)
    const previewPoints = sorted.slice(0, Math.min(renderLimit, sorted.length))
    const outputDir = resolveRenderDir(brand, ratio, seed, parsedFlags.renderDir)
    const resultPoints: PreviewPointMeta[] = []
    const annotationsPayload = {
      schema: 'phantom-visual-spectrum-review-v1',
      createdAt: new Date().toISOString(),
      brand,
      ratio,
      seed,
      points: [] as Array<{
        id: string
        profile: string
        verdict: 'in' | 'out'
        manual: ManualLabel
      }>,
    }

    for (let i = 0; i < previewPoints.length; i += 1) {
      const point = previewPoints[i]
      const profile = point.profile === 'base' ? null : profileById.get(point.profile) ?? null
      const buffer = await renderSpectrumPoint(
        visual,
        point,
        ratio,
        profile,
        parsedFlags.renderHeadline,
      )
      const fileName = `${String(i + 1).padStart(2, '0')}-${safeFileName(point.id)}.png`
      const outPath = join(outputDir, fileName)
      writeFileSync(outPath, buffer)

      resultPoints.push({
        id: point.id,
        profile: point.profile,
        label: point.label,
        fileName,
        verdict: point.verdict,
        failedChecks: point.failedChecks,
        manual: 'unrated',
      })
      annotationsPayload.points.push({
        id: point.id,
        profile: point.profile,
        verdict: point.verdict,
        manual: 'unrated',
      })
      console.log(`[visual] preview ${point.verdict === 'in' ? '✅' : '❌'} ${point.label}`)
    }

    const indexPath = join(outputDir, 'index.html')
    const annotationsPath = join(outputDir, 'annotations.json')
    const indexHtml = buildPreviewIndex({
      brand,
      ratio,
      annotationsCreatedAt: annotationsPayload.createdAt,
      enableLiveRefresh: serve,
      annotationsPath,
      points: resultPoints,
    })
    writeFileSync(indexPath, indexHtml, 'utf8')
    writeFileSync(annotationsPath, JSON.stringify(annotationsPayload, null, 2), 'utf8')
    console.log(`[visual] wrote browser preview to ${indexPath}`)

    if (serve) {
      const server = await startPreviewServer(outputDir, servePort)
      const serveUrl = `http://127.0.0.1:${server.port}/index.html`
      console.log(`[visual] serving preview at ${serveUrl}`)
      console.log('[visual] press Ctrl+C to stop the preview server')
      if (parsed.booleans.has('open')) {
        openInBrowser(serveUrl)
      }

      await new Promise<void>((resolve) => {
        const shutdown = () => {
          void server.close().then(() => resolve())
        }
        process.once('SIGINT', shutdown)
        process.once('SIGTERM', shutdown)
      })
    } else if (parsed.booleans.has('open')) {
      openInBrowser(indexPath)
    }

    preview = {
      outputDir,
      indexPath,
      annotationsPath,
      count: resultPoints.length,
      points: resultPoints,
    }
  }

  return {
    brand,
    ratio,
    topicSeed: seed,
    totalPoints: points.length,
    accepted,
    rejected,
    thresholds: rules,
    preview,
    points: sorted,
  }
}
