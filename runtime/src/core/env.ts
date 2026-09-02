import { existsSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

const loadedRoots = new Set<string>()

export function loadRuntimeEnv(root: string): void {
  if (loadedRoots.has(root)) {
    return
  }

  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    config({ path: envPath, override: false })
  }

  loadedRoots.add(root)
}