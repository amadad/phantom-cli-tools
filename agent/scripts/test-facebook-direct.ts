/**
 * Test direct Facebook Pages posting with image
 * Run: npx tsx test-facebook-direct.ts [brand] [--dry-run]
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { postToFacebook, hasCredentials, getConfiguredBrands, type FacebookBrand } from './src/social/facebook-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find(a => !a.startsWith('--')) as FacebookBrand | undefined

  console.log('Facebook Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Run: npx tsx facebook-auth.ts')
    console.log('Then add the tokens to .env')
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
  const testImageUrl = 'https://picsum.photos/1200/630'
  const testText = `Testing Phantom Loom Facebook integration! ${new Date().toISOString().slice(0, 10)}`

  console.log('\nPosting test to Facebook...')
  const result = await postToFacebook(brand, testText, testImageUrl)

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Post ID:', result.postId)
    console.log('URL:', result.postUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
