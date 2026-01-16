/**
 * Test direct Instagram posting with image
 * Run: npx tsx test-instagram-direct.ts [brand] [--dry-run]
 *
 * Note: Instagram requires publicly accessible image URLs
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { postToInstagram, hasCredentials, getConfiguredBrands, type InstagramBrand } from './src/social/instagram-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find(a => !a.startsWith('--')) as InstagramBrand | undefined

  console.log('Instagram Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Run: npx tsx facebook-auth.ts')
    console.log('Then add the tokens and Instagram User ID to .env')
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

  // Test with a sample image (must be publicly accessible direct URL, no redirects)
  const testImageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1080&fit=crop'
  const testCaption = `Testing Phantom Loom Instagram integration! ${new Date().toISOString().slice(0, 10)} #phantomloom #test`

  console.log('\nPosting test to Instagram...')
  console.log('Note: Instagram requires publicly accessible image URLs')

  const result = await postToInstagram(brand, testCaption, testImageUrl)

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Post ID:', result.postId)
    console.log('URL:', result.postUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
