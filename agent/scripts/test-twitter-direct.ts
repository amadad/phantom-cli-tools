/**
 * Test direct Twitter posting with image
 * Run: npx tsx test-twitter-direct.ts [brand] [--dry-run]
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { postToTwitter, hasCredentials, getConfiguredBrands, type TwitterBrand } from './src/social/twitter-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find(a => !a.startsWith('--')) as TwitterBrand | undefined

  console.log('Twitter Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Add to .env:')
    console.log('  TWITTER_API_KEY=...')
    console.log('  TWITTER_API_SECRET=...')
    console.log('  TWITTER_SCTY_ACCESS_TOKEN=...')
    console.log('  TWITTER_SCTY_ACCESS_SECRET=...')
    return
  }

  const brand = brandArg || configured[0]
  if (!hasCredentials(brand)) {
    console.log(`\nBrand "${brand}" not configured`)
    return
  }

  console.log(`\nTesting brand: ${brand}`)

  if (dryRun) {
    console.log('Dry run mode - not posting')
    return
  }

  // Test with a sample image
  const testImageUrl = 'https://picsum.photos/800/800'
  const testText = `Testing Phantom Loom direct Twitter integration with image support! ${new Date().toISOString().slice(0, 10)}`

  console.log('\nPosting test tweet with image...')
  const result = await postToTwitter(brand, testText, testImageUrl)

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Tweet ID:', result.tweetId)
    console.log('URL:', result.tweetUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
