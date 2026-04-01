import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { loadBrandFoundation } from '../brands/load'
import { ensureParentDir, resolveRuntimePaths } from '../core/paths'
import { buildCardLabHtml, CARD_LAB_TYPES, type CardLabType } from '../lab/build'
import { renderCardToFile, FIGURES, GRAVITIES, GROUNDS, IMAGE_SUBJECTS, PLATFORMS, type Figure, type Gravity } from '../render/card'

interface LabInput {
  brand?: string
  type: CardLabType
  headline?: string
  body?: string
  eyebrow?: string
  series: 'weekly-insights' | 'weekly-recap' | 'signal-drop' | 'custom'
  platform: 'twitter' | 'linkedin' | 'instagram'
  seed?: string
  out?: string
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {}
  let index = 0

  while (index < args.length) {
    const arg = args[index]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`)
      }
      parsed[key] = value
      index += 2
      continue
    }
    index += 1
  }

  return parsed
}

function usage(): string {
  return [
    'Usage:',
    '  lab card --brand <id> [--type quote] [--headline "..."] [--out path]',
    '  lab render --brand <id> --figure statement --gravity center --ground cream [--platform linkedin] [--image topography] [--headline "..."] [--body "..."] [--out path.png]',
    '',
    'Figures: ' + FIGURES.join(', '),
    'Gravities: ' + GRAVITIES.join(', '),
    'Grounds: ' + GROUNDS.map(g => g.id).join(', '),
    'Platforms: ' + Object.keys(PLATFORMS).join(', '),
    'Images: ' + IMAGE_SUBJECTS.join(', '),
  ].join('\n')
}

function isCardLabType(value: string): value is CardLabType {
  return CARD_LAB_TYPES.includes(value as CardLabType)
}

function normalizeInput(args: string[]): LabInput {
  const parsed = parseArgs(args)
  const type = parsed.type ?? 'quote'
  const platform = parsed.platform ?? 'linkedin'
  const series = parsed.series ?? 'weekly-insights'

  if (!isCardLabType(type)) {
    throw new Error(`Invalid card type: ${type}. Expected one of: ${CARD_LAB_TYPES.join(', ')}`)
  }

  if (!['twitter', 'linkedin', 'instagram'].includes(platform)) {
    throw new Error('Invalid platform: ' + platform + '. Expected one of: twitter, linkedin, instagram')
  }

  if (!['weekly-insights', 'weekly-recap', 'signal-drop', 'custom'].includes(series)) {
    throw new Error('Invalid series: ' + series + '. Expected one of: weekly-insights, weekly-recap, signal-drop, custom')
  }

  return {
    brand: parsed.brand,
    type,
    headline: parsed.headline,
    body: parsed.body,
    eyebrow: parsed.eyebrow,
    series: series as LabInput['series'],
    platform: platform as LabInput['platform'],
    seed: parsed.seed,
    out: parsed.out,
  }
}

function resolveGivecareFontsDir(): string | undefined {
  const candidates = [
    resolve(process.cwd(), '..', '..', 'givecare', 'apps', 'web-site', 'public', 'fonts'),
    resolve(process.cwd(), '..', 'givecare', 'apps', 'web-site', 'public', 'fonts'),
    resolve('/Users/amadad/projects/givecare/apps/web-site/public/fonts'),
  ]

  return candidates.find((candidate) => existsSync(join(candidate, 'alegreya-400.woff2')))
}

function ensureLabFonts(outputPath: string): void {
  const sourceDir = resolveGivecareFontsDir()
  if (!sourceDir) {
    return
  }

  const fontsDir = join(dirname(outputPath), 'fonts')
  if (!existsSync(fontsDir)) {
    mkdirSync(fontsDir, { recursive: true })
  }

  const fontFiles = [
    'alegreya-400.woff2',
    'alegreya-latin-wght-normal.woff2',
    'gabarito-latin-400-normal.woff2',
  ]

  for (const file of fontFiles) {
    copyFileSync(join(sourceDir, file), join(fontsDir, file))
  }
}

export function runLabCommand(args: string[], root?: string): unknown {
  const [subcommand, ...rest] = args

  if (subcommand === 'render') {
    return runLabRender(rest, root)
  }

  if (subcommand !== 'card') {
    throw new Error(usage())
  }

  const input = normalizeInput(rest)
  if (!input.brand) {
    throw new Error(usage())
  }

  const paths = resolveRuntimePaths(root)
  const brand = loadBrandFoundation(input.brand, { root: paths.root })
  const outputPath = input.out
    ? join(paths.root, input.out)
    : join(paths.stateDir, 'lab', `${brand.id}-${input.type}.html`)

  ensureParentDir(outputPath)
  ensureLabFonts(outputPath)

  const html = buildCardLabHtml({
    brand,
    brandAssetBasePath: join(paths.brandsDir, brand.id),
    fontHrefPrefix: './fonts',
    initialCardType: input.type,
    initialHeadline: input.headline,
    initialBody: input.body,
    initialEyebrow: input.eyebrow,
    initialPlatform: input.platform,
    initialSeed: input.seed,
    initialSeries: input.series,
  })

  writeFileSync(outputPath, html, 'utf8')

  return {
    brand: brand.id,
    type: input.type,
    path: outputPath,
    next: `Open ${outputPath} in a browser to explore variants and save presets.`,
    series: input.series,
  }
}

function runLabRender(args: string[], root?: string): unknown {
  const parsed = parseArgs(args)

  const figure = (parsed.figure || 'statement') as Figure
  const gravity = (parsed.gravity || 'center') as Gravity
  const groundId = parsed.ground || 'cream'
  const platform = parsed.platform || 'linkedin'
  const image = parsed.image || 'topography'

  if (!FIGURES.includes(figure)) throw new Error('Invalid figure: ' + figure + '. Options: ' + FIGURES.join(', '))
  if (!GRAVITIES.includes(gravity)) throw new Error('Invalid gravity: ' + gravity + '. Options: ' + GRAVITIES.join(', '))
  if (!GROUNDS.find(g => g.id === groundId)) throw new Error('Invalid ground: ' + groundId + '. Options: ' + GROUNDS.map(g => g.id).join(', '))
  if (!PLATFORMS[platform]) throw new Error('Invalid platform: ' + platform + '. Options: ' + Object.keys(PLATFORMS).join(', '))

  const paths = resolveRuntimePaths(root)

  // Load brand for defaults if provided
  const brandName = parsed.brand ? loadBrandFoundation(parsed.brand, { root: paths.root }).name : 'GiveCare'

  const headline = parsed.headline || 'Care is infrastructure'
  const body = parsed.body || 'The care economy is valued at $1 trillion in unpaid labor annually.'
  const eyebrow = parsed.eyebrow || 'CARE ECONOMY'
  const seed = parsed.seed || groundId + '|' + figure + '|' + Date.now()

  const outPath = parsed.out
    ? resolve(paths.root, parsed.out)
    : join(paths.stateDir, 'cards', `${figure}-${gravity}-${groundId}-${platform}.png`)

  const result = renderCardToFile({
    figure,
    gravity,
    ground: groundId,
    platform,
    eyebrow,
    headline,
    body,
    statNum: parsed['stat-num'],
    statLabel: parsed['stat-label'],
    image,
    brandName,
    seed,
    out: outPath,
  })

  return {
    figure,
    gravity,
    ground: groundId,
    platform,
    image,
    path: result.path,
  }
}
