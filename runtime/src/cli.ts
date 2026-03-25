#!/usr/bin/env npx tsx

import { runCli } from './cli/index'

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

