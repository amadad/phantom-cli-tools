import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const token = process.env.LINKEDIN_GIVECARE_ACCESS_TOKEN
const orgId = process.env.LINKEDIN_GIVECARE_ORG_ID

async function main() {
  console.log('Testing LinkedIn API...\n')

  // Test 1: Get user info with v2 API
  console.log('=== Test 1: v2/me ===')
  const meResponse = await fetch('https://api.linkedin.com/v2/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  console.log('Status:', meResponse.status)
  console.log('Response:', await meResponse.text())

  // Test 2: Try v2/ugcPosts API (legacy but works)
  console.log('\n=== Test 2: Text-only post via v2/ugcPosts ===')
  const postBody = {
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: 'Testing LinkedIn API ' + new Date().toISOString().slice(11, 19)
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postBody)
  })

  console.log('Status:', postResponse.status)
  console.log('Headers:', Object.fromEntries(postResponse.headers.entries()))
  console.log('Response:', await postResponse.text())
}

main().catch(console.error)
