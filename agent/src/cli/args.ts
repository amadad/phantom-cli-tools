/**
 * Shared argument parsing for CLI commands
 *
 * Handles the common pattern: <brand> "<topic>" --flag value --bool
 */

import { getDefaultBrand, discoverBrands } from '../core/paths'

export interface ParsedArgs {
  brand: string
  topic: string
  flags: Record<string, string>
  booleans: Set<string>
}

/**
 * Parse CLI args into brand, topic, named flags, and boolean flags.
 *
 *   parseArgs(args)
 *   → { brand: "givecare", topic: "caregiver burnout", flags: { style: "s09" }, booleans: Set(["quick"]) }
 *
 * Positional: first = brand (falls back to default), rest = topic.
 * Quoted strings override topic detection.
 * --flag value or --flag=value → flags map.
 * --bool (no following value or next arg starts with --) → booleans set.
 */
export function parseArgs(args: string[], knownFlags: string[] = []): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string> = {}
  const booleans = new Set<string>()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        // --flag=value
        const key = arg.slice(2, eqIdx)
        flags[key] = arg.slice(eqIdx + 1)
      } else {
        const key = arg.slice(2)
        const next = args[i + 1]
        // Check if this flag expects a value (not a boolean)
        if (next && !next.startsWith('--') && knownFlags.includes(key)) {
          flags[key] = next
          i++
        } else {
          booleans.add(key)
        }
      }
    } else {
      positional.push(arg)
    }
  }

  // Extract brand + topic from positionals
  // When only one positional is given, check if it's a known brand name
  // before assuming it's a topic (prevents wrong-brand writes/posts)
  let brand = getDefaultBrand()
  let topic = ''
  const knownBrands = discoverBrands()

  if (positional.length >= 2) {
    brand = positional[0]
    topic = positional.slice(1).join(' ')
  } else if (positional.length === 1) {
    if (knownBrands.includes(positional[0])) {
      brand = positional[0]
    } else {
      topic = positional[0]
    }
  }

  // Quoted string in raw args overrides topic
  const quotedMatch = args.join(' ').match(/"([^"]+)"/)
  if (quotedMatch) topic = quotedMatch[1]

  return { brand, topic, flags, booleans }
}
