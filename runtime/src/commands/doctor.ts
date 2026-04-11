import { existsSync } from 'fs'
import { createRuntime } from '../runtime/runtime'
import { resolveRuntimePaths } from '../core/paths'
import { doctorRunner, type DoctorCheck } from '../lib/agent-cli'

export async function runDoctorCommand(args: string[], root?: string): Promise<unknown> {
  const json = args.includes('--json') // caller already strips --json; kept for standalone use
  const paths = resolveRuntimePaths(root)
  const runtime = createRuntime({ root })

  const checks: DoctorCheck[] = [
    {
      name: 'GEMINI_API_KEY or GOOGLE_API_KEY set',
      check: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      hint: 'Export GEMINI_API_KEY (or GOOGLE_API_KEY) — https://aistudio.google.com/apikey',
    },
    {
      name: 'runtime root exists',
      check: () => existsSync(paths.root),
      hint: `Missing: ${paths.root}`,
    },
    {
      name: 'brands directory exists',
      check: () => existsSync(paths.brandsDir),
      hint: `Missing: ${paths.brandsDir}`,
    },
    {
      name: 'sqlite db writable',
      check: () => existsSync(paths.dbPath) || existsSync(paths.stateDir),
      hint: `Missing state dir: ${paths.stateDir}`,
    },
    {
      name: 'runtime health probe',
      check: () => {
        const health = runtime.health() as Record<string, unknown>
        return typeof health.totalRuns === 'number'
      },
      hint: 'runtime.health() failed',
    },
  ]

  // doctorRunner writes PASS/FAIL lines to stderr so the JSON envelope stays clean on stdout.
  // exitOnFail:false lets the CLI layer turn failures into its own error envelope.
  const failures = await doctorRunner(checks, { exitOnFail: false })
  const health = runtime.health()

  const data = {
    ok: failures === 0,
    failures,
    health,
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set' : 'missing',
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'set' : 'missing',
    },
    paths: {
      root: paths.root,
      dbPath: paths.dbPath,
      brandsDir: paths.brandsDir,
      stateDir: paths.stateDir,
    },
  }

  if (failures > 0) {
    throw new Error(`doctor: ${failures} check(s) failed`)
  }

  void json
  return data
}
