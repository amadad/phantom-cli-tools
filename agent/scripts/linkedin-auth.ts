/**
 * LinkedIn OAuth 2.0 flow — captures both access_token AND refresh_token.
 *
 * Headless mode (default on servers): prints URL, you open in your browser,
 * authorize, then paste the redirect URL back here.
 *
 * Run: npx tsx scripts/linkedin-auth.ts <brand>
 */

import { readFileSync, writeFileSync } from 'fs'
import { URL } from 'url'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env')
config({ path: ENV_PATH })
// Also load home .env for shared credentials
config({ path: join(process.env.HOME || '/home/deploy', '.env') })

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3333/callback'
const SCOPES = [
  'r_basicprofile',
  'w_organization_social',
  'r_organization_social',
  'rw_organization_admin'
].join(' ')

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
}

async function getAccessToken(code: string): Promise<TokenResponse> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

function upsertEnvValue(envContent: string, key: string, value: string): string {
  const needle = `${key}="`
  const start = envContent.indexOf(needle)
  if (start !== -1) {
    const valueStart = start + needle.length
    const valueEnd = envContent.indexOf('"', valueStart)
    if (valueEnd !== -1) {
      return envContent.slice(0, valueStart) + value + envContent.slice(valueEnd)
    }
  }
  return envContent.trimEnd() + `\n${key}="${value}"\n`
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function saveTokens(brandName: string, tokens: TokenResponse): Promise<void> {
  const brandUpper = brandName.toUpperCase()
  const accessDays = Math.round(tokens.expires_in / 86400)

  // Also update home .env (where platform creds live on server)
  const homeEnvPath = join(process.env.HOME || '/home/deploy', '.env')
  for (const envPath of [ENV_PATH, homeEnvPath]) {
    try {
      let envContent = readFileSync(envPath, 'utf-8')
      envContent = upsertEnvValue(envContent, `LINKEDIN_${brandUpper}_ACCESS_TOKEN`, tokens.access_token)
      if (tokens.refresh_token) {
        envContent = upsertEnvValue(envContent, `LINKEDIN_${brandUpper}_REFRESH_TOKEN`, tokens.refresh_token)
      }
      writeFileSync(envPath, envContent)
    } catch { /* skip if file doesn't exist */ }
  }

  console.log(`\nSaved LINKEDIN_${brandUpper}_ACCESS_TOKEN (expires in ${accessDays} days)`)

  if (tokens.refresh_token) {
    const refreshDays = tokens.refresh_token_expires_in
      ? Math.round(tokens.refresh_token_expires_in / 86400)
      : 365
    console.log(`Saved LINKEDIN_${brandUpper}_REFRESH_TOKEN (expires in ${refreshDays} days)`)
    console.log('Auto-refresh is now enabled — weekly cron will keep this alive.')
  } else {
    console.log('\nNo refresh_token returned.')
    console.log('Your app may need Community Management API enabled for refresh tokens.')
  }

  console.log('\n========== SUCCESS ==========')
  console.log(`Brand: ${brandName}`)
  console.log(`Access token: ${accessDays} days`)
  console.log(`Refresh token: ${tokens.refresh_token ? 'saved' : 'not available'}`)
  console.log('==============================\n')
}

async function main() {
  const brand = process.argv[2]

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env')
    return
  }

  if (!brand) {
    console.log('Usage: npx tsx scripts/linkedin-auth.ts <brand>')
    return
  }

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('state', 'phantomloom')

  console.log(`\nLinkedIn OAuth — ${brand}`)
  console.log('='.repeat(40))
  console.log('\n1. Open this URL in your browser:\n')
  console.log(authUrl.toString())
  console.log('\n2. Log in and authorize the app')
  console.log('3. Your browser will redirect to localhost:3333/callback?code=...')
  console.log('   (The page will fail to load — that\'s expected)')
  console.log('4. Copy the FULL URL from your browser\'s address bar')
  console.log('   and paste it below:\n')

  const input = await prompt('Paste redirect URL: ')

  // Extract the code from the pasted URL
  let code: string | null = null
  try {
    const parsed = new URL(input)
    code = parsed.searchParams.get('code')
  } catch {
    // Maybe they just pasted the code directly
    if (input.length > 10 && !input.includes(' ')) {
      code = input
    }
  }

  if (!code) {
    console.error('Could not extract authorization code from input.')
    console.error('Expected a URL like: http://localhost:3333/callback?code=AQR...&state=phantomloom')
    return
  }

  console.log('\nExchanging code for tokens...')
  const tokens = await getAccessToken(code)
  await saveTokens(brand, tokens)
}

main().catch(console.error)
