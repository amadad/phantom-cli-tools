#!/usr/bin/env npx tsx
/**
 * Hook Bank - Store and retrieve proven content hooks
 *
 * Usage:
 *   npx tsx hook-bank.ts <brand> add --hook="..." --category=curiosity --multiplier=50
 *   npx tsx hook-bank.ts <brand> list [--category=curiosity]
 *   npx tsx hook-bank.ts <brand> search "topic"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getIntelPath, ensureIntelDir } from './paths'
import { getDefaultBrand } from '../core/paths'

// Hook categories based on viral content patterns
export type HookCategory =
  | 'curiosity'      // "I tried X for 30 days..."
  | 'controversy'    // Hot takes, counterintuitive claims
  | 'transformation' // Before/after, journey stories
  | 'secret'         // "Nobody talks about this..."
  | 'listicle'       // "5 things I wish I knew..."
  | 'story'          // Narrative hooks
  | 'question'       // Rhetorical questions
  | 'statistic'      // Data-driven hooks

export interface HookPattern {
  id: string
  original: string           // The hook as discovered
  amplified?: string         // 10x more extreme version
  category: HookCategory
  multiplier: number         // Source post's viral multiplier (5, 10, 50, 100)
  platform: string           // Where discovered (instagram, tiktok, etc.)
  sourceUrl?: string         // Original post URL
  themes: string[]           // Related themes (caregiving, burnout, etc.)
  createdAt: string
  usedCount: number          // How many times we've used this pattern
  lastUsedAt?: string
}

export interface HookBank {
  brand: string
  lastUpdated: string
  hooks: HookPattern[]
  stats: {
    totalHooks: number
    byCategory: Record<HookCategory, number>
    avgMultiplier: number
  }
}

function getHookBankPath(brand: string): string {
  return getIntelPath(brand, 'hooks.json')
}

export function loadHookBank(brand: string): HookBank {
  const path = getHookBankPath(brand)

  if (!existsSync(path)) {
    // Create empty bank
    const empty: HookBank = {
      brand,
      lastUpdated: new Date().toISOString(),
      hooks: [],
      stats: {
        totalHooks: 0,
        byCategory: {
          curiosity: 0, controversy: 0, transformation: 0, secret: 0,
          listicle: 0, story: 0, question: 0, statistic: 0
        },
        avgMultiplier: 0
      }
    }
    return empty
  }

  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function saveHookBank(bank: HookBank): void {
  const path = getHookBankPath(bank.brand)
  ensureIntelDir(bank.brand)

  // Update stats
  bank.stats.totalHooks = bank.hooks.length
  bank.stats.byCategory = {
    curiosity: 0, controversy: 0, transformation: 0, secret: 0,
    listicle: 0, story: 0, question: 0, statistic: 0
  }

  let totalMultiplier = 0
  for (const hook of bank.hooks) {
    bank.stats.byCategory[hook.category]++
    totalMultiplier += hook.multiplier
  }

  bank.stats.avgMultiplier = bank.hooks.length > 0
    ? totalMultiplier / bank.hooks.length
    : 0

  bank.lastUpdated = new Date().toISOString()
  writeFileSync(path, JSON.stringify(bank, null, 2))
}

export function addHook(
  brand: string,
  hook: Omit<HookPattern, 'id' | 'createdAt' | 'usedCount'>
): HookPattern {
  const bank = loadHookBank(brand)

  const newHook: HookPattern = {
    ...hook,
    id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    usedCount: 0
  }

  bank.hooks.push(newHook)
  saveHookBank(bank)

  return newHook
}

export function findHooks(
  brand: string,
  options: {
    category?: HookCategory
    theme?: string
    minMultiplier?: number
    limit?: number
  } = {}
): HookPattern[] {
  const bank = loadHookBank(brand)
  let results = bank.hooks

  if (options.category) {
    results = results.filter(h => h.category === options.category)
  }

  if (options.theme) {
    const theme = options.theme.toLowerCase()
    results = results.filter(h =>
      h.themes.some(t => t.toLowerCase().includes(theme)) ||
      h.original.toLowerCase().includes(theme)
    )
  }

  if (options.minMultiplier) {
    const min = options.minMultiplier
    results = results.filter(h => h.multiplier >= min)
  }

  // Sort by multiplier (highest first), then by least used
  results.sort((a, b) => {
    if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier
    return a.usedCount - b.usedCount
  })

  if (options.limit) {
    results = results.slice(0, options.limit)
  }

  return results
}

export function markHookUsed(brand: string, hookId: string): void {
  const bank = loadHookBank(brand)
  const hook = bank.hooks.find(h => h.id === hookId)

  if (hook) {
    hook.usedCount++
    hook.lastUsedAt = new Date().toISOString()
    saveHookBank(bank)
  }
}

export function getHookForTopic(
  brand: string,
  topic: string,
  preferredCategory?: HookCategory
): HookPattern | null {
  // First try to find hooks matching the topic theme
  let hooks = findHooks(brand, {
    theme: topic,
    minMultiplier: 10,
    limit: 5
  })

  // If preferred category specified, filter further
  if (preferredCategory && hooks.length > 0) {
    const categoryFiltered = hooks.filter(h => h.category === preferredCategory)
    if (categoryFiltered.length > 0) {
      hooks = categoryFiltered
    }
  }

  // If no theme matches, get highest multiplier unused hooks
  if (hooks.length === 0) {
    hooks = findHooks(brand, { minMultiplier: 50, limit: 3 })
  }

  if (hooks.length === 0) {
    return null
  }

  // Return least-used hook from candidates
  return hooks.reduce((least, h) =>
    h.usedCount < least.usedCount ? h : least
  )
}

/**
 * Get the next best hook to use (highest value, least used)
 * Used when no specific topic is provided
 */
export function getNextHook(brand: string): HookPattern | null {
  const hooks = findHooks(brand, { minMultiplier: 10, limit: 10 })

  if (hooks.length === 0) {
    return null
  }

  // Score by value/usage ratio
  return hooks.reduce((best, h) => {
    const bestScore = best.multiplier / (best.usedCount + 1)
    const hScore = h.multiplier / (h.usedCount + 1)
    return hScore > bestScore ? h : best
  })
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args[0] || getDefaultBrand()
  const command = args[1] || 'list'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`HOOK BANK: ${brand.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)

  if (command === 'list') {
    const categoryArg = args.find(a => a.startsWith('--category='))
    const category = categoryArg?.split('=')[1] as HookCategory | undefined

    const hooks = findHooks(brand, { category, limit: 20 })

    if (hooks.length === 0) {
      console.log('\nNo hooks found. Add some with:')
      console.log(`  npx tsx hook-bank.ts ${brand} add --hook="Your hook" --category=curiosity --multiplier=50`)
      return
    }

    console.log(`\nFound ${hooks.length} hooks:\n`)
    for (const hook of hooks) {
      console.log(`[${hook.multiplier}x] [${hook.category}] ${hook.original}`)
      if (hook.amplified) console.log(`  → ${hook.amplified}`)
      console.log(`  Themes: ${hook.themes.join(', ')} | Used: ${hook.usedCount}x`)
      console.log()
    }
  } else if (command === 'add') {
    const hookArg = args.find(a => a.startsWith('--hook='))
    const categoryArg = args.find(a => a.startsWith('--category='))
    const multiplierArg = args.find(a => a.startsWith('--multiplier='))
    const themesArg = args.find(a => a.startsWith('--themes='))
    const platformArg = args.find(a => a.startsWith('--platform='))

    if (!hookArg) {
      console.error('Missing --hook="..." argument')
      process.exit(1)
    }

    const newHook = addHook(brand, {
      original: hookArg.split('=').slice(1).join('='),
      category: (categoryArg?.split('=')[1] || 'curiosity') as HookCategory,
      multiplier: parseInt(multiplierArg?.split('=')[1] || '10'),
      themes: themesArg?.split('=')[1].split(',') || [],
      platform: platformArg?.split('=')[1] || 'unknown'
    })

    console.log(`\n✓ Added hook: ${newHook.id}`)
    console.log(`  "${newHook.original}"`)
  } else if (command === 'search') {
    const query = args[2] || ''
    const hooks = findHooks(brand, { theme: query, limit: 10 })

    console.log(`\nSearch: "${query}" - Found ${hooks.length} hooks\n`)
    for (const hook of hooks) {
      console.log(`[${hook.multiplier}x] ${hook.original}`)
    }
  } else if (command === 'stats') {
    const bank = loadHookBank(brand)
    console.log(`\nTotal hooks: ${bank.stats.totalHooks}`)
    console.log(`Avg multiplier: ${bank.stats.avgMultiplier.toFixed(1)}x`)
    console.log(`\nBy category:`)
    for (const [cat, count] of Object.entries(bank.stats.byCategory)) {
      if (count > 0) console.log(`  ${cat}: ${count}`)
    }
  }
}

const isDirect = process.argv[1]?.endsWith('hook-bank.ts')
if (isDirect) {
  main().catch(console.error)
}
