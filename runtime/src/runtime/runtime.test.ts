import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { createRuntime } from './runtime'
import { openRuntimeDb } from './db'
import { getSocialAuthReport, type SocialPublishRequest } from '../publish/social'

const roots: string[] = []
const envKeys = new Set<string>()
const savedImageApiKeys: Record<string, string | undefined> = {}
const IMAGE_API_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY']

function suppressImageApiKeys(): void {
  for (const key of IMAGE_API_KEYS) {
    delete process.env[key]
  }
}

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'loom-runtime-'))
  roots.push(root)
  mkdirSync(join(root, 'brands', 'givecare'), { recursive: true })
  writeFileSync(
    join(root, 'brands', 'givecare', 'brand.yml'),
    `
id: givecare
name: GiveCare
positioning: Care as infrastructure.
audiences:
  - id: caregivers
    summary: Family caregivers balancing work and care.
offers:
  - id: invisiblebench
    summary: Benchmarking and care tooling.
proof_points:
  - Caregiving is operational work.
pillars:
  - id: care-economy
    perspective: Caregiving is infrastructure and should be discussed as such.
    signals:
      - caregiver benefits
      - care deserts
    format: analysis
    frequency: weekly
  - id: policy
    perspective: Policy should be judged by whether it reduces caregiver burden.
    signals:
      - paid leave
      - Medicaid waivers
    format: opinionated-take
    frequency: weekly
voice:
  tone: Warm, direct, specific.
  style: Human, plainspoken.
  do:
    - Name the problem directly.
  dont:
    - Use therapeutic cliches.
channels:
  social:
    objective: Build signal and authority.
  blog:
    objective: Publish durable longform thinking.
  outreach:
    objective: Start useful conversations.
  respond:
    objective: Reply with clarity and care.
visual:
  palette:
    background: "#FDF9EC"
    primary: "#3D1600"
    accent: "#FF9F00"
response_playbooks:
  - id: skeptical-comment
    trigger: skepticism
    approach: Clarify the claim and add evidence.
outreach_playbooks:
  - id: intro
    trigger: first-touch
    approach: Lead with a sharp observation and one ask.
`.trim(),
  )
  return root
}

function setEnv(key: string, value: string): void {
  process.env[key] = value
  envKeys.add(key)
}

// Suppress image API keys during tests so explore step uses skip path
for (const key of IMAGE_API_KEYS) {
  savedImageApiKeys[key] = process.env[key]
  delete process.env[key]
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }

  for (const key of envKeys) {
    delete process.env[key]
  }
  envKeys.clear()

  // Keep image API keys suppressed across tests
  for (const key of IMAGE_API_KEYS) {
    delete process.env[key]
  }
})

// Restore after all tests
afterAll(() => {
  for (const key of IMAGE_API_KEYS) {
    if (savedImageApiKeys[key] !== undefined) {
      process.env[key] = savedImageApiKeys[key]
    }
  }
})

describe('runtime workflows', () => {
  test('runs social.post and stores review-ready artifacts', async () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })
    suppressImageApiKeys()

    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver benefits gap' },
    })

    expect(run.status).toBe('in_review')

    const details = runtime.inspectRun(run.id)
    expect(details.artifacts.map((artifact) => artifact.type)).toEqual([
      'signal_packet',
      'brief',
      'draft_set',
      'explore_grid',
      'image_brief',
      'source_image',
      'asset_set',
    ])

    const imageBrief = details.artifacts.find((artifact) => artifact.type === 'image_brief')
    expect(imageBrief?.data).toMatchObject({
      channel: 'social',
      brand: 'givecare',
    })

    const draftSet = details.artifacts.find((artifact) => artifact.type === 'draft_set')
    const socialMain = Array.isArray(draftSet?.data.variants)
      ? draftSet.data.variants.find((variant) => typeof variant === 'object' && variant && (variant as Record<string, unknown>).id === 'social-main') as Record<string, unknown> | undefined
      : undefined
    expect(String(socialMain?.body)).toContain('Caregiving is infrastructure and should be discussed as such.')

    const sourceImage = details.artifacts.find((artifact) => artifact.type === 'source_image')
    expect(typeof sourceImage?.data.imagePath).toBe('string')
    expect(existsSync(String(sourceImage?.data.imagePath))).toBe(true)

    const asset = details.artifacts.find((artifact) => artifact.type === 'asset_set')
    const platformAssets = asset?.data.platformAssets as Record<string, string> | undefined
    expect(Object.keys(platformAssets ?? {})).toEqual(['facebook', 'instagram', 'linkedin', 'threads', 'twitter'])
    expect(existsSync(String(platformAssets?.twitter))).toBe(true)
    expect(existsSync(String(platformAssets?.instagram))).toBe(true)
  })

  test('runs blog.post and creates outline and article draft artifacts', async () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })
    suppressImageApiKeys()

    const run = await runtime.runWorkflow({
      workflow: 'blog.post',
      brand: 'givecare',
      input: {
        topic: 'why caregiver benefits fail',
        sources: ['State of caregiving support'],
      },
    })

    const details = runtime.inspectRun(run.id)
    expect(run.status).toBe('in_review')
    expect(details.artifacts.map((artifact) => artifact.type)).toEqual([
      'signal_packet',
      'brief',
      'outline',
      'article_draft',
    ])
  })

  test('includes the selected brand pillar in the brief', async () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })
    suppressImageApiKeys()

    const run = await runtime.runWorkflow({
      workflow: 'blog.post',
      brand: 'givecare',
      input: {
        topic: 'why caregiver benefits fail',
        pillar: 'policy',
      },
    })

    const details = runtime.inspectRun(run.id)
    const brief = details.artifacts.find((artifact) => artifact.type === 'brief')
    const article = details.artifacts.find((artifact) => artifact.type === 'article_draft')

    expect(brief?.data).toMatchObject({
      pillar: 'policy',
      format: 'opinionated-take',
      perspective: 'Policy should be judged by whether it reduces caregiver burden.',
      signals: ['paid leave', 'Medicaid waivers'],
    })
    expect(String(article?.data.markdown)).toContain('Policy should be judged by whether it reduces caregiver burden.')
    expect(String(article?.data.markdown)).toContain('paid leave and Medicaid waivers')
  })

  test('marks runs as failed with the failing step and error message', async () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })
    suppressImageApiKeys()

    await expect(runtime.runWorkflow({
      workflow: 'blog.post',
      brand: 'givecare',
      input: {
        topic: 'why caregiver benefits fail',
        pillar: 'missing-pillar',
      },
    })).rejects.toThrow('Unknown pillar for brand givecare: missing-pillar')

    const db = openRuntimeDb(root)
    const row = db.prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT 1`).get() as Record<string, unknown>

    expect(row.status).toBe('failed')
    expect(row.current_step).toBe('brief')
    expect(row.error_message).toBe('Unknown pillar for brand givecare: missing-pillar')
    expect(runtime.health()).toMatchObject({ failedRuns: 1, totalRuns: 1 })
  })

  test('approves, publishes through the social publisher, and retries a run with lineage intact', async () => {
    const root = createWorkspace()
    setEnv('TWITTER_GIVECARE_API_KEY', 'api-key')
    setEnv('TWITTER_GIVECARE_API_SECRET', 'api-secret')
    setEnv('TWITTER_GIVECARE_ACCESS_TOKEN', 'access-token')
    setEnv('TWITTER_GIVECARE_ACCESS_SECRET', 'access-secret')
    setEnv('LINKEDIN_GIVECARE_ACCESS_TOKEN', 'linkedin-token')
    setEnv('LINKEDIN_GIVECARE_ORG_ID', '12345')
    setEnv('FACEBOOK_GIVECARE_PAGE_ACCESS_TOKEN', 'facebook-token')
    setEnv('FACEBOOK_GIVECARE_PAGE_ID', '54321')
    setEnv('INSTAGRAM_GIVECARE_ACCESS_TOKEN', 'instagram-token')
    setEnv('INSTAGRAM_GIVECARE_USER_ID', 'ig-user')
    setEnv('THREADS_GIVECARE_ACCESS_TOKEN', 'threads-token')
    setEnv('THREADS_GIVECARE_USER_ID', 'threads-user')

    const publishCalls: SocialPublishRequest[] = []
    const runtime = createRuntime({ root })
    suppressImageApiKeys()
    runtime.setSocialPublisher(async (request) => {
      publishCalls.push(request)
      return request.platforms.map((platform) => ({
        platform,
        success: true,
        postId: `post-${platform}`,
        postUrl: `https://example.com/${platform}`,
      }))
    })

    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver burnout is operational, not personal failure' },
    })

    const approved = runtime.reviewRun(run.id, {
      decision: 'approve',
      note: 'Use variant A',
      selectedVariantId: 'social-alt',
    })
    expect(approved.status).toBe('approved')

    const published = await runtime.publishRun(run.id)
    expect(published.status).toBe('published')
    expect(publishCalls).toHaveLength(1)
    expect(publishCalls[0].platforms).toEqual(['twitter', 'linkedin', 'facebook'])
    expect(publishCalls[0].text).toContain('caregiver burnout is operational, not personal failure')
    expect(publishCalls[0].text).toContain('GiveCare')
    expect(Object.keys(publishCalls[0].platformAssets)).toEqual(['facebook', 'instagram', 'linkedin', 'threads', 'twitter'])
    expect(existsSync(publishCalls[0].platformAssets.twitter)).toBe(true)
    expect(existsSync(publishCalls[0].platformAssets.instagram)).toBe(true)

    const retried = await runtime.retryRun(run.id, { fromStep: 'draft' })
    expect(retried.parentRunId).toBe(run.id)
    expect(retried.status).toBe('in_review')
  })

  test('reports per-platform credential status for social publishing', () => {
    setEnv('TWITTER_GIVECARE_API_KEY', 'api-key')
    setEnv('TWITTER_GIVECARE_API_SECRET', 'api-secret')
    setEnv('TWITTER_GIVECARE_ACCESS_TOKEN', 'access-token')
    setEnv('TWITTER_GIVECARE_ACCESS_SECRET', 'access-secret')
    setEnv('INSTAGRAM_GIVECARE_ACCESS_TOKEN', 'instagram-token')
    setEnv('INSTAGRAM_GIVECARE_USER_ID', 'ig-user')

    const report = getSocialAuthReport('givecare')
    const twitter = report.platforms.find((platform) => platform.platform === 'twitter')
    const linkedin = report.platforms.find((platform) => platform.platform === 'linkedin')
    const instagram = report.platforms.find((platform) => platform.platform === 'instagram')

    expect(twitter).toMatchObject({ configured: true, supported: true })
    expect(linkedin?.configured).toBe(false)
    expect(linkedin?.missing.length).toBeGreaterThan(0)
    expect(instagram?.configured).toBe(false)
    expect(instagram?.missing).toContain('R2_CONFIG')
  })

  test('dry-run social publish does not mark the run as published', async () => {
    const root = createWorkspace()
    setEnv('TWITTER_GIVECARE_API_KEY', 'api-key')
    setEnv('TWITTER_GIVECARE_API_SECRET', 'api-secret')
    setEnv('TWITTER_GIVECARE_ACCESS_TOKEN', 'access-token')
    setEnv('TWITTER_GIVECARE_ACCESS_SECRET', 'access-secret')

    const runtime = createRuntime({ root })
    suppressImageApiKeys()
    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver systems' },
    })

    runtime.reviewRun(run.id, {
      decision: 'approve',
      selectedVariantId: 'social-main',
    })

    const result = await runtime.publishRun(run.id, { dryRun: true })
    expect(result.status).toBe('approved')
  })
})
