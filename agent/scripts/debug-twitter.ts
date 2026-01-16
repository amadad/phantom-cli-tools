import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

interface Creds {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

function generateOAuthHeader(method: string, url: string, creds: Creds, extraParams: Record<string, string> = {}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0'
  }

  const allParams = { ...oauthParams, ...extraParams }

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(allParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&')
    )
  ].join('&')

  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessSecret)}`
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64')
  oauthParams.oauth_signature = signature

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${headerParts}`
}

async function main() {
  // Test a single brand (default) - replace with your brand-specific env vars
  const creds: Creds = {
    apiKey: process.env['TWITTER_BRAND_API_KEY']!,
    apiSecret: process.env['TWITTER_BRAND_API_SECRET']!,
    accessToken: process.env['TWITTER_BRAND_ACCESS_TOKEN']!,
    accessSecret: process.env['TWITTER_BRAND_ACCESS_SECRET']!
  }

  console.log('API Key length:', creds.apiKey?.length)
  console.log('Access Token starts:', creds.accessToken?.substring(0, 20))

  // First test text-only tweet to verify write permission
  console.log('\n=== Test 1: Text-only tweet (v2 API) ===')
  const tweetUrl = 'https://api.twitter.com/2/tweets'
  const tweetAuth = generateOAuthHeader('POST', tweetUrl, creds)

  const tweetResponse = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: tweetAuth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: 'Testing write permission ' + new Date().toISOString().slice(11, 19) })
  })

  console.log('Status:', tweetResponse.status)
  const tweetData = await tweetResponse.text()
  console.log('Response:', tweetData)

  // Test media upload (v1.1) using multipart/form-data
  console.log('\n=== Test 2: Media upload (v1.1 API) ===')
  const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json'

  // Download a small test image
  const imgResponse = await fetch('https://picsum.photos/100/100')
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())

  console.log('Image size:', imgBuffer.length, 'bytes')

  // Use FormData for multipart upload
  const formData = new FormData()
  formData.append('media', new Blob([imgBuffer]), 'image.jpg')

  // For multipart, don't include body params in OAuth signature
  const mediaAuth = generateOAuthHeader('POST', mediaUrl, creds)

  const mediaResponse = await fetch(mediaUrl, {
    method: 'POST',
    headers: {
      Authorization: mediaAuth
    },
    body: formData
  })

  console.log('Status:', mediaResponse.status)
  const mediaText = await mediaResponse.text()
  console.log('Response:', mediaText)
}

main().catch(console.error)
