import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from '../core/paths'
import { getBrandsDir } from '../core/paths'
import type { CommandContext } from '../cli/types'
import { createConsoleOutput } from '../cli/output'

export interface BrandInitResult {
  name: string
  displayName: string
  path: string
  files: {
    brandConfig: string
    rubric: string
    queue: string
    learnings: string
  }
}

function formatDisplayName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function replacePlaceholders(path: string, replacements: Record<string, string>): void {
  const content = readFileSync(path, 'utf-8')
  let updated = content
  for (const [token, value] of Object.entries(replacements)) {
    updated = updated.replaceAll(token, value)
  }
  writeFileSync(path, updated)
}

export async function run(args: string[], ctx?: CommandContext): Promise<BrandInitResult> {
  const output = ctx?.output ?? createConsoleOutput()
  const [subcommand, nameArg] = args

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    output.info('Usage: brand init <name>')
    throw new Error('Missing subcommand')
  }

  if (subcommand !== 'init') {
    output.error(`Unknown brand subcommand: ${subcommand}`)
    throw new Error(`Unknown brand subcommand: ${subcommand}`)
  }

  if (!nameArg) {
    output.error('Usage: brand init <name>')
    throw new Error('Missing brand name')
  }

  const name = nameArg.toLowerCase()
  if (!/^[a-z0-9-]+$/.test(name)) {
    output.error('Brand name must be lowercase and contain only letters, numbers, or hyphens')
    throw new Error('Invalid brand name')
  }

  const brandsDir = getBrandsDir()
  const templateDir = join(brandsDir, '_template')
  const brandDir = join(brandsDir, name)

  if (!existsSync(templateDir)) {
    output.error(`Brand template not found at ${templateDir}`)
    throw new Error('Brand template missing')
  }

  if (existsSync(brandDir)) {
    output.error(`Brand already exists: ${brandDir}`)
    throw new Error('Brand already exists')
  }

  cpSync(templateDir, brandDir, { recursive: true })

  const brandTemplatePath = join(brandDir, '_template-brand.yml')
  const rubricTemplatePath = join(brandDir, '_template-rubric.yml')
  const brandConfigPath = join(brandDir, `${name}-brand.yml`)
  const rubricPath = join(brandDir, `${name}-rubric.yml`)

  renameSync(brandTemplatePath, brandConfigPath)
  renameSync(rubricTemplatePath, rubricPath)

  const displayName = formatDisplayName(name)
  const replacements = {
    '__BRAND_NAME__': displayName,
    '__BRAND_SLUG__': name
  }

  replacePlaceholders(brandConfigPath, replacements)
  replacePlaceholders(rubricPath, replacements)
  replacePlaceholders(join(brandDir, 'assets', 'logo.svg'), replacements)

  output.info(`Brand initialized: ${brandDir}`)

  return {
    name,
    displayName,
    path: brandDir,
    files: {
      brandConfig: brandConfigPath,
      rubric: rubricPath,
      queue: join(brandDir, 'queue.json'),
      learnings: join(brandDir, 'learnings.json')
    }
  }
}
