/**
 * Instagram Direct OAuth 2.0 flow (Instagram Platform API)
 * This uses Instagram's direct login, not Facebook OAuth
 * Run: npx tsx instagram-auth.ts
 */

import { createServer } from 'http'
import { URL } from 'url'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const APP_ID = process.env.INSTAGRAM_APP_ID
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://7e628944ad81.ngrok-free.app/callback'

// Instagram Business scopes
const SCOPES = 'instagram_business_basic,instagram_business_content_publish'

async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  user_id: string
}> {
  const formData = new URLSearchParams({
    client_id: APP_ID!,
    client_secret: APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code
  })

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function getLongLivedToken(shortToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: APP_SECRET!,
    access_token: shortToken
  })

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params}`
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Long-lived token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function getUserInfo(accessToken: string): Promise<{
  id: string
  username: string
  account_type: string
}> {
  const params = new URLSearchParams({
    fields: 'id,username,account_type',
    access_token: accessToken
  })

  const response = await fetch(`https://graph.instagram.com/me?${params}`)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Get user info failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function main() {
  if (!APP_ID || !APP_SECRET) {
    console.log('Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET in .env')
    console.log('\nAdd these from your Facebook Developer App settings:')
    console.log('INSTAGRAM_APP_ID=your_instagram_app_id')
    console.log('INSTAGRAM_APP_SECRET=your_instagram_app_secret')
    return
  }

  const authUrl = new URL('https://api.instagram.com/oauth/authorize')
  authUrl.searchParams.set('client_id', APP_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('response_type', 'code')

  console.log('Instagram Direct OAuth Flow')
  console.log('===========================\n')
  console.log('1. A browser window will open')
  console.log('2. Log in with your Instagram account')
  console.log('3. Authorize the app')
  console.log('4. The access token will be displayed here\n')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost:3335')

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const errorReason = url.searchParams.get('error_reason')
      const errorDescription = url.searchParams.get('error_description')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Authorization Failed</h1><p>You can close this window.</p>')
        console.log('\nAuthorization failed:', error)
        console.log('Reason:', errorReason)
        console.log('Description:', errorDescription)
        server.close()
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Success!</h1><p>Check your terminal for the access token.</p>')

        try {
          console.log('\nExchanging code for access token...')
          const shortTokenData = await exchangeCodeForToken(code)
          console.log('User ID:', shortTokenData.user_id)

          console.log('Getting long-lived token...')
          const longTokenData = await getLongLivedToken(shortTokenData.access_token)

          console.log('Getting user info...')
          const userInfo = await getUserInfo(longTokenData.access_token)

          console.log('\n========== SUCCESS ==========\n')
          console.log(`Username: @${userInfo.username}`)
          console.log(`User ID: ${userInfo.id}`)
          console.log(`Account Type: ${userInfo.account_type}`)
          console.log(`\nAccess Token: ${longTokenData.access_token.substring(0, 50)}...`)
          console.log(`Expires in: ${longTokenData.expires_in} seconds (~${Math.round(longTokenData.expires_in / 86400)} days)`)
          console.log('\nAdd to your .env (replace BRAND with scty or givecare):')
          console.log(`INSTAGRAM_BRAND_USER_ID="${userInfo.id}"`)
          console.log(`INSTAGRAM_BRAND_ACCESS_TOKEN="${longTokenData.access_token}"`)
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
