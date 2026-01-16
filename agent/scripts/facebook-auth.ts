/**
 * Facebook OAuth 2.0 flow for getting Page Access Tokens
 * Also retrieves Instagram Business Account ID if linked
 * Run: npx tsx facebook-auth.ts
 */

import { createServer } from 'http'
import { URL } from 'url'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const APP_ID = process.env.FACEBOOK_APP_ID
const APP_SECRET = process.env.FACEBOOK_APP_SECRET
const REDIRECT_URI = 'http://localhost:3334/callback'

// Permissions for Facebook Pages only (Instagram uses separate Instagram Platform API)
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts'
].join(',')

interface PageInfo {
  id: string
  name: string
  access_token: string
  instagram_business_account?: {
    id: string
    username: string
  }
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: APP_ID!,
    client_secret: APP_SECRET!,
    redirect_uri: REDIRECT_URI,
    code
  })

  const response = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params}`
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

async function getLongLivedToken(shortToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: APP_ID!,
    client_secret: APP_SECRET!,
    fb_exchange_token: shortToken
  })

  const response = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${params}`
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Long-lived token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

async function getPages(userAccessToken: string): Promise<PageInfo[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: userAccessToken
  })

  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?${params}`
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Get pages failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.data || []
}

async function main() {
  if (!APP_ID || !APP_SECRET) {
    console.log('Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET in .env')
    console.log('\nTo set up:')
    console.log('1. Go to developers.facebook.com')
    console.log('2. Create an app (Business type)')
    console.log('3. Add Facebook Login product')
    console.log('4. Add these to .env:')
    console.log('   FACEBOOK_APP_ID=your_app_id')
    console.log('   FACEBOOK_APP_SECRET=your_app_secret')
    return
  }

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  authUrl.searchParams.set('client_id', APP_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('response_type', 'code')

  console.log('Facebook/Instagram OAuth Flow')
  console.log('==============================\n')
  console.log('1. A browser window will open')
  console.log('2. Log in with the Facebook account that admins your Pages')
  console.log('3. Authorize the app')
  console.log('4. Select which Pages to connect')
  console.log('5. Page tokens will be displayed here\n')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:3334`)

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
        res.end('<h1>Success!</h1><p>Check your terminal for Page tokens.</p>')

        try {
          console.log('\nExchanging code for access token...')
          const shortToken = await exchangeCodeForToken(code)

          console.log('Getting long-lived token...')
          const longToken = await getLongLivedToken(shortToken)

          console.log('Fetching Pages...\n')
          const pages = await getPages(longToken)

          if (pages.length === 0) {
            console.log('No Pages found. Make sure you:')
            console.log('1. Admin at least one Facebook Page')
            console.log('2. Selected that Page during authorization')
            server.close()
            return
          }

          console.log('========== SUCCESS ==========\n')
          console.log(`Found ${pages.length} Page(s):\n`)

          for (const page of pages) {
            console.log(`--- ${page.name} ---`)
            console.log(`Page ID: ${page.id}`)
            console.log(`Page Access Token: ${page.access_token.substring(0, 50)}...`)

            if (page.instagram_business_account) {
              console.log(`Instagram: @${page.instagram_business_account.username}`)
              console.log(`Instagram ID: ${page.instagram_business_account.id}`)
            } else {
              console.log('Instagram: Not linked')
            }
            console.log()
          }

          console.log('Add to your .env (replace BRAND with your brand):\n')
          for (const page of pages) {
            console.log(`# ${page.name}`)
            console.log(`FACEBOOK_BRAND_PAGE_ID="${page.id}"`)
            console.log(`FACEBOOK_BRAND_PAGE_ACCESS_TOKEN="${page.access_token}"`)
            if (page.instagram_business_account) {
              console.log(`INSTAGRAM_BRAND_USER_ID="${page.instagram_business_account.id}"`)
            }
            console.log()
          }

          console.log('Note: Page Access Tokens are long-lived (~60 days)')
          console.log('==============================\n')
        } catch (err) {
          console.error('\nError:', err)
        }

        server.close()
      }
    }
  })

  server.listen(3334, async () => {
    console.log('Waiting for authorization...\n')
    console.log('Opening browser...\n')
    await open(authUrl.toString())
  })
}

main().catch(console.error)
