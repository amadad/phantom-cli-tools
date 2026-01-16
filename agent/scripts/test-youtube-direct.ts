/**
 * Test direct YouTube video upload
 * Run: npx tsx test-youtube-direct.ts [brand] <video-path> [--short] [--dry-run]
 *
 * Example:
 *   npx tsx test-youtube-direct.ts <brand> ./test-video.mp4 --short
 */

import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { uploadToYouTube, hasCredentials, getConfiguredBrands, type YouTubeBrand } from './src/social/youtube-direct.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const isShort = args.includes('--short')
  const filteredArgs = args.filter(a => !a.startsWith('--'))

  const brandArg = filteredArgs[0] as YouTubeBrand | undefined
  const videoPath = filteredArgs[1]

  console.log('YouTube Direct API Test\n')

  // Check configured brands
  const configured = getConfiguredBrands()
  console.log('Configured brands:', configured.length ? configured.join(', ') : 'none')

  if (configured.length === 0) {
    console.log('\nNo brands configured. Run: npx tsx youtube-auth.ts')
    console.log('Then add the tokens to .env')
    return
  }

  const brand = brandArg || configured[0]
  if (!hasCredentials(brand)) {
    console.log(`\nBrand "${brand}" not configured`)
    return
  }

  console.log(`\nTesting brand: ${brand}`)

  if (!videoPath) {
    console.log('\nUsage: npx tsx test-youtube-direct.ts [brand] <video-path> [--short]')
    console.log('Example: npx tsx test-youtube-direct.ts <brand> ./video.mp4 --short')
    return
  }

  if (dryRun) {
    console.log('Dry run mode - not uploading')
    console.log(`Would upload: ${videoPath}`)
    console.log(`As Short: ${isShort}`)
    return
  }

  const testTitle = `Test Upload ${new Date().toISOString().slice(0, 10)}`
  const testDescription = `Testing Phantom Loom YouTube integration!\n\n#test #phantomloom`

  console.log(`\nUploading ${isShort ? 'Short' : 'video'} to YouTube...`)
  console.log(`File: ${videoPath}`)

  const result = await uploadToYouTube(brand, videoPath, testTitle, testDescription, {
    isShort,
    tags: ['test', 'phantomloom'],
    privacyStatus: 'private' // Start as private for testing
  })

  if (result.success) {
    console.log('\nSuccess!')
    console.log('Video ID:', result.videoId)
    console.log('URL:', result.videoUrl)
  } else {
    console.log('\nFailed:', result.error)
  }
}

main().catch(console.error)
