/**
 * YouTube OAuth 2.0 flow for getting Access Tokens
 * Run: npx tsx youtube-auth.ts
 */

import { createServer } from 'http'
import { URL } from 'url'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'https://7e628944ad81.ngrok-free.app/callback'

// YouTube upload scope
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
].join(' ')

async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function getChannelInfo(accessToken: string): Promise<{
  id: string
  title: string
  customUrl?: string
}> {
  const params = new URLSearchParams({
    part: 'snippet',
    mine: 'true'
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Get channel info failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube channel found for this account')
  }

  const channel = data.items[0]
  return {
    id: channel.id,
    title: channel.snippet.title,
    customUrl: channel.snippet.customUrl
  }
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env')
    console.log('\nSet up at https://console.cloud.google.com:')
    console.log('1. Enable YouTube Data API v3')
    console.log('2. Create OAuth 2.0 credentials')
    console.log('3. Add to .env:')
    console.log('   YOUTUBE_CLIENT_ID=your_client_id')
    console.log('   YOUTUBE_CLIENT_SECRET=your_client_secret')
    return
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  console.log('YouTube OAuth Flow')
  console.log('==================\n')
  console.log('1. A browser window will open')
  console.log('2. Log in with the Google account that owns the YouTube channel')
  console.log('3. Authorize the app')
  console.log('4. The access token will be displayed here\n')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost:3335')

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Authorization Failed</h1><p>You can close this window.</p>')
        console.log('\nAuthorization failed:', error)
        server.close()
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Success!</h1><p>Check your terminal for the access token.</p>')

        try {
          console.log('\nExchanging code for access token...')
          const tokenData = await exchangeCodeForToken(code)

          console.log('Getting channel info...')
          const channelInfo = await getChannelInfo(tokenData.access_token)

          console.log('\n========== SUCCESS ==========\n')
          console.log(`Channel: ${channelInfo.title}`)
          console.log(`Channel ID: ${channelInfo.id}`)
          if (channelInfo.customUrl) {
            console.log(`URL: youtube.com/${channelInfo.customUrl}`)
          }
          console.log(`\nAccess Token: ${tokenData.access_token.substring(0, 50)}...`)
          console.log(`Refresh Token: ${tokenData.refresh_token.substring(0, 30)}...`)
          console.log(`Expires in: ${tokenData.expires_in} seconds`)
          console.log('\nAdd to your .env (replace BRAND with your brand):')
          console.log(`YOUTUBE_BRAND_CHANNEL_ID="${channelInfo.id}"`)
          console.log(`YOUTUBE_BRAND_ACCESS_TOKEN="${tokenData.access_token}"`)
          console.log(`YOUTUBE_BRAND_REFRESH_TOKEN="${tokenData.refresh_token}"`)
          console.log('\n==============================\n')
        } catch (err) {
          console.error('\nError:', err)
        }

        server.close()
      }
    }
  })

  server.listen(3335, async () => {
    console.log('Waiting for authorization...\n')
    console.log('Opening browser...\n')
    await open(authUrl.toString())
  })
}

main().catch(console.error)
