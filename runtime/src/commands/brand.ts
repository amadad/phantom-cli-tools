import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadBrandFoundation } from '../brands/load'
import { resolveRuntimePaths } from '../core/paths'

const TEMPLATE = `id: __ID__
name: __NAME__
positioning: Replace with the sharpest explanation of the brand.
audiences:
  - id: primary
    summary: Replace with the core audience.
offers:
  - id: primary-offer
    summary: Replace with the main offer.
proof_points:
  - Replace with one concrete proof point.
pillars:
  - id: primary-theme
    perspective: Replace with the recurring angle this brand should own.
    signals:
      - Replace with one signal to monitor.
    format: opinionated-take
    frequency: weekly
voice:
  tone: Direct and specific.
  style: Plainspoken and credible.
  do:
    - Say the real thing plainly.
  dont:
    - Hide behind generic positioning.
channels:
  social:
    objective: Build signal and authority.
  blog:
    objective: Publish durable longform thinking.
  outreach:
    objective: Start useful conversations.
  respond:
    objective: Reply with clarity and care.
visual:
  palette:
    background: "#FFFFFF"
    primary: "#111111"
    accent: "#FF6600"
response_playbooks:
  - id: default-response
    trigger: inbound-question
    approach: Clarify the claim and answer directly.
outreach_playbooks:
  - id: default-outreach
    trigger: first-touch
    approach: Lead with one specific observation and one ask.
`

function displayNameFromId(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function runBrandCommand(args: string[], root?: string): unknown {
  const [subcommand, brandId] = args
  const paths = resolveRuntimePaths(root)

  if (subcommand === 'init') {
    if (!brandId) {
      throw new Error('Usage: brand init <id>')
    }
    const dir = join(paths.brandsDir, brandId)
    mkdirSync(dir, { recursive: true })
    const name = displayNameFromId(brandId)
    writeFileSync(
      join(dir, 'brand.yml'),
      TEMPLATE.replaceAll('__ID__', brandId).replaceAll('__NAME__', name),
      'utf8',
    )
    return { id: brandId, path: join(dir, 'brand.yml') }
  }

  if (subcommand === 'show') {
    if (!brandId) {
      throw new Error('Usage: brand show <id>')
    }
    return loadBrandFoundation(brandId, { root: paths.root })
  }

  if (subcommand === 'validate') {
    if (!brandId) {
      throw new Error('Usage: brand validate <id>')
    }
    const brand = loadBrandFoundation(brandId, { root: paths.root })
    return { valid: true, brand: brand.id }
  }

  throw new Error('Usage: brand <init|show|validate> ...')
}

