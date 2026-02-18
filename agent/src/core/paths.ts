/**
 * Centralized path management
 * Handles project root detection and brand discovery
 */

import { existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

let _projectRoot: string | null = null

/**
 * Get the project root directory
 * Works whether running from agent/ or project root
 */
export function getProjectRoot(): string {
  if (_projectRoot) return _projectRoot

  // Try to find project root by looking for brands/ directory
  let current = process.cwd()

  // If we're in agent/, go up one level
  if (current.endsWith('/agent') || current.endsWith('\\agent')) {
    current = dirname(current)
  }

  // Check if brands/ exists at this level
  if (existsSync(join(current, 'brands'))) {
    _projectRoot = current
    return current
  }

  // Try parent directory
  const parent = dirname(current)
  if (existsSync(join(parent, 'brands'))) {
    _projectRoot = parent
    return parent
  }

  // Fall back to assuming we're in the right place
  _projectRoot = current
  return current
}

/**
 * Get path to agent directory
 * This is where agent's package.json and node_modules live
 */
export function getAgentDir(): string {
  return join(getProjectRoot(), 'agent')
}

/**
 * Get path to brands directory
 */
export function getBrandsDir(): string {
  return join(getProjectRoot(), 'brands')
}

/**
 * Get path to output directory
 */
export function getOutputDir(): string {
  return join(getProjectRoot(), 'output')
}

/**
 * Get path to evaluation log (JSONL)
 * Used by graders and learnings aggregation
 */
export function getEvalLogPath(): string {
  return join(getOutputDir(), 'eval-log.jsonl')
}

/**
 * Get path to a specific brand's directory
 */
export function getBrandDir(brandName: string): string {
  return join(getBrandsDir(), brandName)
}

/**
 * Get path to a specific brand's config file
 * Structure: brands/<name>/<name>-brand.yml
 */
export function getBrandConfigPath(brandName: string): string {
  return join(getBrandDir(brandName), `${brandName}-brand.yml`)
}

/**
 * Get path to a specific brand's rubric file
 * Structure: brands/<name>/<name>-rubric.yml
 */
export function getBrandRubricPath(brandName: string): string {
  return join(getBrandDir(brandName), `${brandName}-rubric.yml`)
}

// Cache discovered brands within a process invocation
let _brandsCache: string[] | null = null

/**
 * Discover available brands from filesystem
 * Looks for directories containing <name>-brand.yml
 * Results are cached per process invocation
 */
export function discoverBrands(): string[] {
  if (_brandsCache) return _brandsCache

  const brandsDir = getBrandsDir()

  if (!existsSync(brandsDir)) {
    console.warn(`[paths] Brands directory not found: ${brandsDir}`)
    return []
  }

  const entries = readdirSync(brandsDir, { withFileTypes: true })
  const brands = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .filter(e => existsSync(join(brandsDir, e.name, `${e.name}-brand.yml`)))
    .map(e => e.name)
    .sort()

  _brandsCache = brands
  return brands
}

/**
 * Clear the brands cache (useful for testing or after brand init)
 */
export function clearBrandsCache(): void {
  _brandsCache = null
}

/**
 * Check if a brand exists
 */
export function brandExists(brandName: string): boolean {
  return existsSync(getBrandConfigPath(brandName))
}

/**
 * Validate brand name against available brands
 */
export function validateBrand(brandName: string): string {
  const brands = discoverBrands()

  if (brands.length === 0) {
    throw new Error('No brands found in brands/ directory')
  }

  if (!brands.includes(brandName)) {
    throw new Error(`Unknown brand: ${brandName}. Available: ${brands.join(', ')}`)
  }

  return brandName
}

/**
 * Get default brand (first available)
 */
export function getDefaultBrand(): string {
  const brands = discoverBrands()
  if (brands.length === 0) {
    throw new Error('No brands found in brands/ directory')
  }
  return brands[0]
}

// Re-export for convenience
export { join, dirname }
