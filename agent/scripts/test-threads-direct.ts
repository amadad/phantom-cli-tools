/**
 * Test direct Threads posting
 * Run: npx tsx test-threads-direct.ts [brand] [--dry-run]
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { postToThreads, hasCredentials, getConfiguredBrands, type ThreadsBrand } from './src/social/threads-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find(a => !a.startsWith('--')) as ThreadsBrand | undefined

  console.log('Threads Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Run: npx tsx threads-auth.ts')
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

  // Test with text and optional image
  const withImage = args.includes('--image')
  const testText = `Testing Phantom Loom Threads integration! ${new Date().toISOString().slice(0, 10)} #phantomloom #test`
  const testImageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1080&fit=crop'

  console.log('\nPosting test to Threads...')
  console.log(withImage ? 'With image' : 'Text only')
  const result = await postToThreads(brand, testText, withImage ? testImageUrl : undefined)

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Post ID:', result.postId)
    console.log('URL:', result.postUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
