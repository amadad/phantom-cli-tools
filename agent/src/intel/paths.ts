/**
 * Intelligence data paths
 * Intel data lives in brands/<brand>/intel/
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getBrandDir } from '../core/paths'

export function getIntelDir(brandName: string): string {
  return join(getBrandDir(brandName), 'intel')
}

export function getIntelPath(brandName: string, ...parts: string[]): string {
  return join(getIntelDir(brandName), ...parts)
}

export function ensureIntelDir(brandName: string): void {
  const dir = getIntelDir(brandName)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
