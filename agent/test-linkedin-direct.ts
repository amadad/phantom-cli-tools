/**
 * Test direct LinkedIn posting with image
 * Run: npx tsx test-linkedin-direct.ts [brand] [--dry-run]
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { postToLinkedIn, hasCredentials, getConfiguredBrands, type LinkedInBrand } from './src/social/linkedin-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find(a => !a.startsWith('--')) as LinkedInBrand | undefined

  console.log('LinkedIn Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Run: npx tsx linkedin-auth.ts')
    console.log('Then add the token to .env')
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
  const testText = `Testing Phantom Loom LinkedIn integration! ${new Date().toISOString().slice(0, 10)}`

  console.log('\nPosting test to LinkedIn...')
  const result = await postToLinkedIn(brand, testText, testImageUrl)

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Post ID:', result.postId)
    console.log('URL:', result.postUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
