import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import { createRuntime } from './runtime'

const roots: string[] = []

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

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }
})

describe('runtime workflows', () => {
  test('runs social.post and stores review-ready artifacts', () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })

    const run = runtime.runWorkflow({
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
      'asset_set',
    ])
  })

  test('runs blog.post and creates outline and article draft artifacts', () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })

    const run = runtime.runWorkflow({
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

  test('approves, publishes, and retries a run with lineage intact', () => {
    const root = createWorkspace()
    const runtime = createRuntime({ root })

    const run = runtime.runWorkflow({
      workflow: 'social.post',
      brand: 'givecare',
      input: { topic: 'caregiver burnout is operational, not personal failure' },
    })

    const approved = runtime.reviewRun(run.id, {
      decision: 'approve',
      note: 'Use variant A',
      selectedVariantId: 'social-main',
    })
    expect(approved.status).toBe('approved')

    const published = runtime.publishRun(run.id)
    expect(published.status).toBe('published')

    const retried = runtime.retryRun(run.id, { fromStep: 'draft' })
    expect(retried.parentRunId).toBe(run.id)
    expect(retried.status).toBe('in_review')
  })
})