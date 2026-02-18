/**
 * Session directory management
 *
 * Each CLI invocation writes output to: output/YYYY-MM-DD/<slug>[-suffix]/
 */

import { mkdirSync } from 'fs'
import { getOutputDir, join } from './paths'

/** Slugify a string for filesystem paths */
export function slugify(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

/** Create a dated session directory and return its path */
export function createSessionDir(slug: string, suffix?: string): string {
  const date = new Date().toISOString().split('T')[0]
  const dirName = suffix ? `${slug}${suffix}` : slug
  const sessionDir = join(getOutputDir(), date, dirName)
  mkdirSync(sessionDir, { recursive: true })
  return sessionDir
}
