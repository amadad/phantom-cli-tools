#!/usr/bin/env npx tsx
/**
 * Audit renderer files for unregistered magic numbers.
 *
 * Compares numeric literals and hex colors in the renderer source files
 * against the known values in RENDERER_DEFAULTS. Reports unregistered
 * constants with file and line number.
 *
 * Usage: npx tsx scripts/audit-renderer-constants.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { RENDERER_DEFAULTS } from '../src/composite/renderer/defaults'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../src')

const FILES = [
  'composite/layouts.ts',
  'composite/renderer/layers/TypeLayer.ts',
  'composite/renderer/layers/GraphicLayer.ts',
]

// Build a set of known numeric values from RENDERER_DEFAULTS
function collectKnownValues(obj: unknown, known = new Set<string>()): Set<string> {
  if (obj === null || obj === undefined) return known
  if (typeof obj === 'number') {
    known.add(String(obj))
    return known
  }
  if (typeof obj === 'string') {
    known.add(obj.toLowerCase())
    return known
  }
  if (typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      collectKnownValues(value, known)
    }
  }
  return known
}

const KNOWN = collectKnownValues(RENDERER_DEFAULTS)

// Whitelist: non-design constants (FNV hash, canvas boilerplate, structural)
const WHITELIST = new Set([
  '0', '1', '2', '3', '4',       // small integers (loop counters, array indices)
  '0.6',                          // gradient start position (structural, not design)
  '0x811c9dc5', '0x01000193',    // FNV-1a hash constants
  '8',                            // min pad floor (px)
  '400', '700',                   // font weights (come from brand config)
  '80',                           // threshold for lg size detection
  '16',                           // parseInt base for hex parsing
])

const NUMERIC_RE = /(?<!\w)(0\.\d+|\d{2,})(?!\w|x[0-9a-f])/gi
const HEX_RE = /#[0-9a-fA-F]{6}\b/g

let issues = 0

for (const file of FILES) {
  const fullPath = resolve(ROOT, file)
  const lines = readFileSync(fullPath, 'utf-8').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip comments and imports
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.includes('import ')) continue

    // Check numeric literals
    for (const match of line.matchAll(NUMERIC_RE)) {
      const val = match[0]
      if (KNOWN.has(val) || WHITELIST.has(val)) continue
      // Skip values that are part of variable references (e.g., rc.type.*)
      if (line.includes('rc.') || line.includes('v.renderer.') || line.includes('cfg.')) continue
      console.log(`  ${file}:${i + 1}  unregistered numeric: ${val}`)
      issues++
    }

    // Check hex colors
    for (const match of line.matchAll(HEX_RE)) {
      const val = match[0].toLowerCase()
      if (KNOWN.has(val)) continue
      if (line.includes('rc.') || line.includes('v.renderer.')) continue
      console.log(`  ${file}:${i + 1}  unregistered hex: ${val}`)
      issues++
    }
  }
}

if (issues === 0) {
  console.log('No unregistered renderer constants found.')
} else {
  console.log(`\n${issues} unregistered constant(s) found.`)
  process.exit(1)
}
