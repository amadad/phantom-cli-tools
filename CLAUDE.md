# Phantom Loom

Brand-driven content generation: **topic → image + copy → post**

## What It Does

1. **Define brand once** - Visual style + voice in YAML
2. **Generate content** - Enter topic, get on-brand image + multi-platform copy
3. **Post** - Publish to Twitter, LinkedIn, Facebook, Instagram, Threads, YouTube

## Platform Support

| Platform | GiveCare | SCTY | Auth Type | Content |
|----------|----------|------|-----------|---------|
| Twitter | ✅ | ✅ | OAuth 1.0a | Text + Images |
| LinkedIn | ✅ | ✅ | OAuth 2.0 | Text + Images |
| Facebook | ✅ | ✅ | OAuth 2.0 | Text + Images |
| Instagram | ✅ | ✅ | Instagram API | Images (required) |
| Threads | ✅ | ✅ | Threads API | Text + Images |
| YouTube | ✅ | ✅ | Google OAuth | Videos/Shorts |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              TanStack Start (port 3000)             │
│  ┌────────────────────────────────────────────────┐ │
│  │                  React UI                      │ │
│  │     Enter topic → Preview image + copy → Post  │ │
│  └────────────────────┬───────────────────────────┘ │
│                       │ Server Functions            │
│  ┌────────────────────▼───────────────────────────┐ │
│  │  Brand Loader │ Content Gen │ Image Gen        │ │
│  │  (YAML)       │ (Gemini 2.5 Flash Lite)        │ │
│  └────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              Social Posting (Direct APIs)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Twitter  │ │ LinkedIn │ │ Facebook │ │  Meta  │ │
│  │ OAuth1.0a│ │ OAuth2.0 │ │ Graph API│ │IG/THR  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌─────────────────────────────────────────────────┐│
│  │              YouTube (Google OAuth)             ││
│  │           Videos & Shorts uploading             ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd web
npm install
npm run dev

# Open http://localhost:3000
```

## File Structure

```
phantom-loom/
├── web/                   # Fullstack app (TanStack Start)
│   └── src/
│       ├── routes/        # Pages (index, generate)
│       ├── lib/
│       │   ├── api.ts     # Client-side API wrapper
│       │   └── server/    # Server functions
│       │       ├── generate.ts   # Content + image generation
│       │       ├── brand.ts      # Brand YAML loader
│       │       ├── image.ts      # Gemini image gen
│       │       └── types.ts
│       └── components/
├── agent/                 # Social posting tools
│   ├── src/social/
│   │   ├── twitter-direct.ts     # Twitter (OAuth 1.0a)
│   │   ├── linkedin-direct.ts    # LinkedIn (OAuth 2.0)
│   │   ├── facebook-direct.ts    # Facebook Pages (Graph API)
│   │   ├── instagram-direct.ts   # Instagram (Platform API)
│   │   ├── threads-direct.ts     # Threads (Threads API)
│   │   └── youtube-direct.ts     # YouTube (Data API v3)
│   ├── test-*.ts                 # Test scripts for each platform
│   ├── linkedin-auth.ts          # LinkedIn OAuth flow
│   ├── facebook-auth.ts          # Facebook OAuth flow
│   ├── instagram-auth.ts         # Instagram OAuth flow
│   ├── threads-auth.ts           # Threads OAuth flow
│   └── youtube-auth.ts           # YouTube/Google OAuth flow
├── brands/                # Brand YAML configs
│   └── givecare.yml
├── galleries/             # Reference images (optional)
├── output/                # Generated images (gitignored)
├── .env                   # API keys (gitignored)
└── CLAUDE.md
```

## Brand Configuration

```yaml
# brands/givecare.yml
name: "GiveCare"

voice:
  tone: "Warm, honest, and empowering"
  style: "Conversational, human-first"
  rules:
    - "Use second-person 'you'"
    - "Keep sentences short"

visual:
  palette:
    primary: "#FF9F1C"
    secondary: "#54340E"
  style: "Documentary photography, soft natural lighting"
  mood: "peaceful, reflective, resilient"
  avoid:
    - "stock photography"
    - "clinical settings"

platforms:
  twitter:
    max_chars: 280
    hashtags: 3
  linkedin:
    max_chars: 3000
    hashtags: 5
```

## Environment Variables

```bash
# .env (at project root)

# =============================================================================
# REQUIRED: Core Services
# =============================================================================
GEMINI_API_KEY=your_gemini_api_key  # Google AI Studio
REPLICATE_API_TOKEN=your_replicate_api_token  # Image/video generation

# =============================================================================
# TWITTER: Direct API (OAuth 1.0a)
# =============================================================================
# Per-brand credentials from developer.twitter.com
TWITTER_SCTY_API_KEY=...
TWITTER_SCTY_API_SECRET=...
TWITTER_SCTY_ACCESS_TOKEN=...
TWITTER_SCTY_ACCESS_SECRET=...

TWITTER_GIVECARE_API_KEY=...
TWITTER_GIVECARE_API_SECRET=...
TWITTER_GIVECARE_ACCESS_TOKEN=...
TWITTER_GIVECARE_ACCESS_SECRET=...

# =============================================================================
# LINKEDIN: OAuth 2.0
# =============================================================================
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_SCTY_ORG_ID=...            # From linkedin.com/company/XXX
LINKEDIN_GIVECARE_ORG_ID=...
LINKEDIN_SCTY_ACCESS_TOKEN=...      # Expires ~60 days
LINKEDIN_GIVECARE_ACCESS_TOKEN=...

# =============================================================================
# FACEBOOK: Graph API v21.0
# =============================================================================
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_SCTY_PAGE_ID=...
FACEBOOK_SCTY_PAGE_ACCESS_TOKEN=... # Expires ~60 days
FACEBOOK_GIVECARE_PAGE_ID=...
FACEBOOK_GIVECARE_PAGE_ACCESS_TOKEN=...

# =============================================================================
# INSTAGRAM: Platform API (separate from Facebook OAuth)
# =============================================================================
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_SCTY_USER_ID=...
INSTAGRAM_SCTY_ACCESS_TOKEN=...     # Expires ~60 days
INSTAGRAM_GIVECARE_USER_ID=...
INSTAGRAM_GIVECARE_ACCESS_TOKEN=...

# =============================================================================
# THREADS: Threads API
# =============================================================================
THREADS_APP_ID=...
THREADS_APP_SECRET=...
THREADS_SCTY_USER_ID=...
THREADS_SCTY_ACCESS_TOKEN=...       # Expires ~60 days
THREADS_GIVECARE_USER_ID=...
THREADS_GIVECARE_ACCESS_TOKEN=...

# =============================================================================
# YOUTUBE: Google OAuth 2.0
# =============================================================================
YOUTUBE_CLIENT_ID=...               # Google Cloud Console
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_SCTY_CHANNEL_ID=...
YOUTUBE_SCTY_ACCESS_TOKEN=...       # Expires ~1 hour (auto-refreshed)
YOUTUBE_SCTY_REFRESH_TOKEN=...      # Used to get new access tokens
YOUTUBE_GIVECARE_CHANNEL_ID=...
YOUTUBE_GIVECARE_ACCESS_TOKEN=...
YOUTUBE_GIVECARE_REFRESH_TOKEN=...

# =============================================================================
# OPTIONAL: Additional Services
# =============================================================================
COMPOSIO_API_KEY=...                # Alternative posting (text-only)
MODAL_TOKEN_ID=...                  # Serverless compute
MODAL_TOKEN_SECRET=...
SLACK_BOT_TOKEN=...                 # Approval notifications
```

## Social Platform Setup

### Twitter Setup
1. Create app at developer.twitter.com (one per brand)
2. Enable OAuth 1.0a with "Read and write" permissions
3. Generate Access Token and Secret
4. Add credentials to `.env`

### LinkedIn Setup
1. Create app at linkedin.com/developers (one shared app)
2. Request "Community Management API" access
3. Add `http://localhost:3333/callback` to redirect URLs
4. Run `cd agent && npx tsx linkedin-auth.ts` for each brand
5. Add org IDs and tokens to `.env`

### Facebook Setup
1. Create app at developers.facebook.com
2. Add "Facebook Login" and "Pages API" products
3. Add `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` permissions
4. Run `cd agent && npx tsx facebook-auth.ts`
5. Add Page IDs and tokens to `.env`

### Instagram Setup (Platform API)
1. Create separate app at developers.facebook.com for Instagram
2. Add "Instagram Platform API" product (NOT "Instagram Basic Display")
3. Add Instagram accounts as "Instagram Testers" in app settings
4. Accept invitations at instagram.com/accounts/manage_access/
5. Set up ngrok: `ngrok http 3335` (Instagram requires HTTPS callback)
6. Add redirect URI to app settings (e.g., `https://xxxx.ngrok-free.app/callback`)
7. Run `cd agent && npx tsx instagram-auth.ts`
8. Add User IDs and tokens to `.env`

### Threads Setup
1. Create app at developers.facebook.com
2. Add "Threads API" product
3. Add Threads accounts as "Threads Testers" in app settings
4. Accept invitations at threads.net → Settings → Account → Website permissions → Invites
5. Use same ngrok tunnel as Instagram
6. Run `cd agent && npx tsx threads-auth.ts`
7. Add User IDs and tokens to `.env`

### YouTube Setup
1. Create project at console.cloud.google.com
2. Enable "YouTube Data API v3"
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:3335/callback` to redirect URIs
5. Add test users if app is "Internal" (or set to "External")
6. Run `cd agent && npx tsx youtube-auth.ts`
7. Add Channel IDs and tokens to `.env`

## Test Posting

```bash
cd agent

# Twitter
npx tsx test-twitter-direct.ts scty
npx tsx test-twitter-direct.ts givecare

# LinkedIn
npx tsx test-linkedin-direct.ts scty
npx tsx test-linkedin-direct.ts givecare

# Facebook
npx tsx test-facebook-direct.ts scty
npx tsx test-facebook-direct.ts givecare

# Instagram (requires image URL)
npx tsx test-instagram-direct.ts scty
npx tsx test-instagram-direct.ts givecare

# Threads (text or text+image)
npx tsx test-threads-direct.ts scty
npx tsx test-threads-direct.ts givecare

# YouTube (requires video file)
npx tsx test-youtube-direct.ts givecare ./video.mp4 --short --dry-run
npx tsx test-youtube-direct.ts scty ./video.mp4
```

## Token Expiration

| Platform | Access Token Lifetime | Refresh Method |
|----------|----------------------|----------------|
| Twitter | Never expires | N/A (OAuth 1.0a) |
| LinkedIn | ~60 days | Re-run linkedin-auth.ts |
| Facebook | ~60 days | Re-run facebook-auth.ts |
| Instagram | ~60 days | Re-run instagram-auth.ts |
| Threads | ~60 days | Re-run threads-auth.ts |
| YouTube | ~1 hour | Auto-refresh via refresh token |

## Tech Stack

- **Framework**: TanStack Start (React fullstack)
- **AI**: Gemini 2.5 Flash Lite (copy + images), Replicate (video)
- **Social APIs**:
  - Twitter (OAuth 1.0a, v1.1 media + v2)
  - LinkedIn (OAuth 2.0, v2/ugcPosts)
  - Facebook (Graph API v21.0)
  - Instagram (Platform API via graph.instagram.com)
  - Threads (Threads API via graph.threads.net)
  - YouTube (Data API v3 with resumable uploads)
- **Styling**: Tailwind CSS
