import { existsSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'

export interface RuntimePaths {
  root: string
  brandsDir: string
  stateDir: string
  artifactsDir: string
  exportsDir: string
  dbPath: string
}

export function resolveRuntimePaths(root?: string): RuntimePaths {
  const resolvedRoot = resolve(root ?? process.env.LOOM_ROOT ?? process.cwd())
  const stateDir = join(resolvedRoot, 'state')
  const artifactsDir = join(stateDir, 'artifacts')
  const exportsDir = join(stateDir, 'exports')

  return {
    root: resolvedRoot,
    brandsDir: join(resolvedRoot, 'brands'),
    stateDir,
    artifactsDir,
    exportsDir,
    dbPath: join(stateDir, 'loom.sqlite'),
  }
}

export function ensureRuntimePaths(paths: RuntimePaths): void {
  for (const target of [paths.brandsDir, paths.stateDir, paths.artifactsDir, paths.exportsDir]) {
    if (!existsSync(target)) {
      mkdirSync(target, { recursive: true })
    }
  }
}

export function ensureParentDir(filePath: string): void {
  const parent = dirname(filePath)
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true })
  }
}
