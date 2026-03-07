#!/usr/bin/env npx tsx
/**
 * Phantom Loom CLI
 */

import { config } from 'dotenv'
import { getProjectRoot, join } from './core/paths'
import { runCli } from './cli/index'

// Load home .env first (platform creds), then project .env (overrides)
// override: true ensures file values win over stale shell env vars
config({ path: join(process.env.HOME || '/home/deploy', '.env'), override: true })
config({ path: join(getProjectRoot(), '.env'), override: true })

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
