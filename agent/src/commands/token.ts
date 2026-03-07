/**
 * Token command — check, refresh, and set OAuth tokens
 *
 * Usage:
 *   token check [brand]                        Check all token statuses
 *   token refresh [brand]                      Refresh expiring tokens
 *   token refresh --all [brand]                Force refresh all refreshable tokens
 *   token set <platform> <brand> <token>       Set a token directly into .env
 */

import { checkTokens, refreshTokens, setToken, type TokenStatus } from '../publish/token-refresh'
import { discoverBrands } from '../core/paths'
import type { CommandContext } from '../cli/types'

function printStatus(results: TokenStatus[]): void {
  for (const r of results) {
    const icon =
      r.status === 'ok' ? '  ok' :
      r.status === 'refreshed' ? '  ok' :
      r.status === 'never_expires' ? '   ~' :
      r.status === 'expired' ? 'FAIL' :
      r.status === 'no_refresh' ? 'FAIL' :
      ' ERR'

    console.log(`  [${icon}] ${r.platform}/${r.brand}: ${r.message}`)
  }
}

export async function run(args: string[], _ctx?: CommandContext): Promise<void> {
  const subcommand = args.find(a => !a.startsWith('-') && a !== 'token') || 'check'
  const forceAll = args.includes('--all')

  // token set <platform> <brand> <token>
  if (subcommand === 'set') {
    const setArgs = args.filter(a => a !== 'token' && a !== 'set' && !a.startsWith('-'))
    if (setArgs.length < 3) {
      console.log('Usage: token set <platform> <brand> <token>')
      console.log('Platforms: instagram, threads, linkedin')
      console.log('Example: token set instagram givecare IGAAQ...')
      return
    }
    const [platform, brand, token] = setArgs
    const result = setToken(platform, brand, token)
    console.log(result)
    return
  }

  const brands = discoverBrands()
  const brandArg = args.find(a => brands.includes(a))
  const targetBrands = brandArg ? [brandArg] : brands

  if (subcommand === 'check') {
    console.log('\nToken Status')
    console.log('\u2500'.repeat(50))

    for (const brand of targetBrands) {
      console.log(`\n${brand}:`)
      const results = await checkTokens(brand)
      if (results.length === 0) {
        console.log('  (no tokens configured)')
      } else {
        printStatus(results)
      }
    }

    console.log()
  } else if (subcommand === 'refresh') {
    console.log('\nToken Refresh')
    console.log('\u2500'.repeat(50))

    for (const brand of targetBrands) {
      console.log(`\n${brand}:`)
      const results = await refreshTokens(brand, forceAll)
      if (results.length === 0) {
        console.log('  (no refreshable tokens)')
      } else {
        printStatus(results)
      }
    }

    console.log()
  } else {
    console.log('Usage:')
    console.log('  token check [brand]                     Check all token statuses')
    console.log('  token refresh [brand]                   Refresh expiring tokens')
    console.log('  token refresh --all [brand]             Force refresh all tokens')
    console.log('  token set <platform> <brand> <token>    Set a token into .env')
  }
}
