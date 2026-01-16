#!/usr/bin/env npx tsx
/**
 * Phantom Loom CLI
 */

import { config } from 'dotenv'
import { getProjectRoot, join } from './core/paths'
import { runCli } from './cli/index'

config({ path: join(getProjectRoot(), '.env') })

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
