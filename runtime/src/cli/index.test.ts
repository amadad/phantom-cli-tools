import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { runCli } from './index'
import { createRuntime } from '../runtime/runtime'

const roots: string[] = []
const IMAGE_API_KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] as const
const savedImageApiKeys = new Map<string, string | undefined>()
const originalHome = process.env.HOME

function createWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'loom-cli-'))
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
    'utf8',
  )
  return root
}

function suppressImageApiKeys(): void {
  for (const key of IMAGE_API_KEYS) {
    if (!savedImageApiKeys.has(key)) {
      savedImageApiKeys.set(key, process.env[key])
    }
    delete process.env[key]
  }
}

async function captureStdout<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string }> {
  const chunks: string[] = []
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)

  try {
    const result = await fn()
    return { result, stdout: chunks.join('') }
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }

  delete process.env.LOOM_ROOT
  if (originalHome === undefined) {
    delete process.env.HOME
  } else {
    process.env.HOME = originalHome
  }

  for (const key of IMAGE_API_KEYS) {
    const value = savedImageApiKeys.get(key)
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  savedImageApiKeys.clear()
})

describe.sequential('runCli', () => {
  test('returns a JSON error envelope for invalid workflows', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root

    const { result, stdout } = await captureStdout(() =>
      runCli(['run', 'not-a-workflow', '--brand', 'givecare', '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toEqual({
      status: 'error',
      error: {
        message: 'Invalid workflow: not-a-workflow. Expected one of: social.post, blog.post, outreach.touch, respond.reply',
      },
    })
  })

  test('rejects invalid review variants', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root
    suppressImageApiKeys()

    const runtime = createRuntime({ root })
    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver systems' },
    })

    const { result, stdout } = await captureStdout(() =>
      runCli(['review', 'approve', run.id, '--variant', 'missing-variant', '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toEqual({
      status: 'error',
      error: {
        message: `Variant not found for run ${run.id}: missing-variant`,
      },
    })
  })

  test('rejects invalid publish platforms', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root
    suppressImageApiKeys()

    const runtime = createRuntime({ root })
    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver systems' },
    })
    runtime.reviewRun(run.id, { decision: 'approve', selectedVariantId: 'social-main' })

    const { result, stdout } = await captureStdout(() =>
      runCli(['publish', run.id, '--platforms', 'mastodon', '--dry-run', '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toEqual({
      status: 'error',
      error: {
        message: 'Invalid platform(s): mastodon. Expected one of: twitter, linkedin, facebook, instagram, threads',
      },
    })
  })

  test('rejects inspect artifact paths outside state artifacts', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root

    const { result, stdout } = await captureStdout(() =>
      runCli(['inspect', 'artifact', join(root, 'brands', 'givecare', 'brand.yml'), '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toMatchObject({
      status: 'error',
      error: {
        message: expect.stringContaining(join(root, 'state', 'artifacts')),
      },
    })
  })

  test('rejects publish requests for unconfigured platforms', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root
    suppressImageApiKeys()

    const runtime = createRuntime({ root })
    const run = await runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver systems' },
    })
    runtime.reviewRun(run.id, { decision: 'approve', selectedVariantId: 'social-main' })

    const { result, stdout } = await captureStdout(() =>
      runCli(['publish', run.id, '--platforms', 'twitter', '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toEqual({
      status: 'error',
      error: {
        message: 'Requested platforms not configured for givecare: twitter. Run "loom ops auth check --brand givecare" first.',
      },
    })
  })

  test('rejects brand init when the brand already exists', async () => {
    const root = createWorkspace()
    process.env.LOOM_ROOT = root
    process.env.HOME = root

    const { result, stdout } = await captureStdout(() =>
      runCli(['brand', 'init', 'givecare', '--json']),
    )

    expect(result).toBe(1)
    expect(JSON.parse(stdout)).toMatchObject({
      status: 'error',
      error: {
        message: expect.stringContaining(join(root, 'brands', 'givecare', 'brand.yml')),
      },
    })
  })
})
