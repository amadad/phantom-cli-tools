/**
 * LinkedIn OAuth 2.0 flow for getting access tokens
 * Run: npx tsx linkedin-auth.ts
 */

import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { URL } from 'url'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env')
config({ path: ENV_PATH })

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3333/callback'
const SCOPES = [
  'r_basicprofile',
  'w_organization_social',
  'r_organization_social',
  'rw_organization_admin'
].join(' ')

async function getAccessToken(code: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!
    }).toString()
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function main() {
  const brand = process.argv[2]

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env')
    console.log('\nAdd these to your .env:')
    console.log('LINKEDIN_CLIENT_ID=your_linkedin_client_id')
    console.log('LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret')
    return
  }

  if (!brand) {
    console.log('Usage: npx tsx scripts/linkedin-auth.ts <brand>')
    console.log('Example: npx tsx scripts/linkedin-auth.ts scty')
    return
  }

  // Capture after validation so TypeScript narrows to string in closures
  const brandName = brand

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('state', 'phantomloom')

  console.log(`LinkedIn OAuth Flow — ${brand}`)
  console.log('==================\n')
  console.log(`1. A browser window will open`)
  console.log(`2. Log in with the LinkedIn account that admins the ${brand} company page`)
  console.log('3. Authorize the app')
  console.log('4. The token will be saved to .env automatically\n')

  // Start local server to catch callback
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:3333`)

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
        res.end('<h1>Success!</h1><p>You can close this window and check your terminal.</p>')

        try {
          console.log('\nExchanging code for access token...')
          const tokens = await getAccessToken(code)
          const days = Math.round(tokens.expires_in / 86400)

          // Auto-save to .env
          const envKey = `LINKEDIN_${brandName.toUpperCase()}_ACCESS_TOKEN`
          const envContent = readFileSync(ENV_PATH, 'utf-8')
          const needle = `${envKey}="`
          const start = envContent.indexOf(needle)
          if (start !== -1) {
            const valueStart = start + needle.length
            const valueEnd = envContent.indexOf('"', valueStart)
            if (valueEnd !== -1) {
              const updated = envContent.slice(0, valueStart) + tokens.access_token + envContent.slice(valueEnd)
              writeFileSync(ENV_PATH, updated)
              console.log(`\nSaved to .env as ${envKey}`)
            }
          } else {
            console.log(`\nWarning: ${envKey} not found in .env. Add manually:`)
            console.log(`${envKey}="${tokens.access_token}"`)
          }

          console.log('\n========== SUCCESS ==========')
          console.log(`\nBrand: ${brand}`)
          console.log(`Expires in: ${days} days`)
          console.log('\n==============================\n')
        } catch (err) {
          console.error('\nError getting token:', err)
        }

        server.close()
      }
    }
  })

  server.listen(3333, async () => {
    console.log('Waiting for authorization...\n')
    console.log('Opening browser to:', authUrl.toString().substring(0, 80) + '...\n')
    await open(authUrl.toString())
  })
}

main().catch(console.error)
