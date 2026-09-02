import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadBrandFoundation } from '../brands/load'
import { ensureParentDir, ensureRuntimePaths, resolveRuntimePaths } from '../core/paths'
import { createId, nowIso } from '../core/ids'
import type {
  ArtifactRecord,
  ArtifactType,
  BrandFoundation,
  RetryInput,
  ReviewInput,
  RunDetails,
  RunRecord,
  RunWorkflowInput,
  RunStatus,
  StepName,
  WorkflowName,
} from '../domain/types'
import { openRuntimeDb } from './db'

interface RuntimeOptions {
  root?: string
}

interface WorkflowContext {
  brand: BrandFoundation
  workflow: WorkflowName
  runId: string
  input: Record<string, unknown>
  priorArtifacts: ArtifactRecord[]
}

interface StepDefinition {
  name: StepName
  run: (context: WorkflowContext) => Array<{ type: ArtifactType; data: Record<string, unknown> }>
}

const WORKFLOWS: Record<WorkflowName, StepDefinition[]> = {
  'social.post': [
    { name: 'signal', run: buildSignalArtifacts },
    { name: 'brief', run: buildBriefArtifacts },
    { name: 'draft', run: buildSocialDraftArtifacts },
    { name: 'render', run: buildAssetArtifacts },
  ],
  'blog.post': [
    { name: 'signal', run: buildSignalArtifacts },
    { name: 'brief', run: buildBriefArtifacts },
    { name: 'outline', run: buildOutlineArtifacts },
    { name: 'draft', run: buildArticleDraftArtifacts },
  ],
  'outreach.touch': [
    { name: 'signal', run: buildSignalArtifacts },
    { name: 'brief', run: buildBriefArtifacts },
    { name: 'draft', run: buildOutreachDraftArtifacts },
  ],
  'respond.reply': [
    { name: 'signal', run: buildSignalArtifacts },
    { name: 'brief', run: buildBriefArtifacts },
    { name: 'draft', run: buildResponseDraftArtifacts },
  ],
}

function workflowChannel(workflow: WorkflowName): 'social' | 'blog' | 'outreach' | 'respond' {
  if (workflow === 'social.post') return 'social'
  if (workflow === 'blog.post') return 'blog'
  if (workflow === 'outreach.touch') return 'outreach'
  return 'respond'
}

function selectStepIndex(workflow: WorkflowName, fromStep?: StepName): number {
  if (!fromStep) return 0
  const index = WORKFLOWS[workflow].findIndex((step) => step.name === fromStep)
  return index === -1 ? 0 : index
}

function buildSignalArtifacts(context: WorkflowContext) {
  return [
    {
      type: 'signal_packet' as const,
      data: {
        workflow: context.workflow,
        channel: workflowChannel(context.workflow),
        topic: context.input.topic ?? null,
        source: context.input.source ?? null,
        sources: context.input.sources ?? [],
        account: context.input.account ?? null,
        goal: context.input.goal ?? null,
      },
    },
  ]
}

function buildBriefArtifacts(context: WorkflowContext) {
  const channel = workflowChannel(context.workflow)
  const primaryAudience = context.brand.audiences[0]?.id ?? 'general'

  return [
    {
      type: 'brief' as const,
      data: {
        workflow: context.workflow,
        channel,
        brand: context.brand.name,
        objective: context.brand.channels[channel].objective,
        audience: primaryAudience,
        positioning: context.brand.positioning,
        offer: context.brand.offers[0]?.id ?? null,
        proofPoints: context.brand.proofPoints.slice(0, 2),
        topic: context.input.topic ?? context.input.goal ?? context.input.source ?? 'Untitled',
      },
    },
  ]
}

function buildSocialDraftArtifacts(context: WorkflowContext) {
  const brief = findArtifact(context.priorArtifacts, 'brief')
  const topic = String(brief?.data.topic ?? context.input.topic ?? 'Untitled')

  return [
    {
      type: 'draft_set' as const,
      data: {
        channel: 'social',
        variants: [
          {
            id: 'social-main',
            hook: `${topic} is not a personal failing.`,
            body: `${topic} is usually framed as an individual problem. ${context.brand.name} treats it like an operational one.`,
            cta: 'Start with the system, not the slogan.',
          },
          {
            id: 'social-alt',
            hook: `The story around ${topic} is broken.`,
            body: `Most advice around ${topic} is soft and generic. The sharper move is to name the structural failure and offer one concrete next step.`,
            cta: 'Say the real thing plainly.',
          },
        ],
      },
    },
  ]
}

function buildOutreachDraftArtifacts(context: WorkflowContext) {
  const account = String(context.input.account ?? 'the account')
  const goal = String(context.input.goal ?? 'start a useful conversation')

  return [
    {
      type: 'draft_set' as const,
      data: {
        channel: 'outreach',
        variants: [
          {
            id: 'outreach-main',
            subject: `A sharp thought about ${account}`,
            body: `I noticed a gap in how ${account} talks about the problem. ${goal}. If useful, I can send a tighter point of view.`,
          },
        ],
      },
    },
  ]
}

function buildResponseDraftArtifacts(context: WorkflowContext) {
  const source = String(context.input.source ?? 'the message')

  return [
    {
      type: 'draft_set' as const,
      data: {
        channel: 'respond',
        variants: [
          {
            id: 'respond-main',
            body: `Thanks for raising ${source}. The useful response is to clarify the claim, anchor it in evidence, and answer without getting defensive.`,
          },
        ],
      },
    },
  ]
}

function buildOutlineArtifacts(context: WorkflowContext) {
  const topic = String(context.input.topic ?? 'Untitled')

  return [
    {
      type: 'outline' as const,
      data: {
        title: topic,
        sections: [
          'What is actually happening',
          'Why common advice misses',
          'What a better approach looks like',
          'Where to go next',
        ],
      },
    },
  ]
}

function buildArticleDraftArtifacts(context: WorkflowContext) {
  const outline = findArtifact(context.priorArtifacts, 'outline')
  const sections = Array.isArray(outline?.data.sections) ? outline?.data.sections : []
  const title = String(outline?.data.title ?? context.input.topic ?? 'Untitled')
  const body = [
    `# ${title}`,
    '',
    `## ${sections[0] ?? 'What is actually happening'}`,
    `${context.brand.name} treats this as an operational problem, not a branding problem.`,
    '',
    `## ${sections[1] ?? 'Why common advice misses'}`,
    `Most guidance stays generic. The better move is to name the structural constraint and show one concrete consequence.`,
    '',
    `## ${sections[2] ?? 'What a better approach looks like'}`,
    `Build around audience reality, specific evidence, and one strong claim that the reader can test.`,
    '',
    `## ${sections[3] ?? 'Where to go next'}`,
    `Turn the argument into action: a sharper post, a better reply, or a more grounded outreach touch.`,
  ].join('\n')

  return [
    {
      type: 'article_draft' as const,
      data: {
        title,
        markdown: body,
      },
    },
  ]
}

function buildAssetArtifacts(context: WorkflowContext) {
  const draft = findArtifact(context.priorArtifacts, 'draft_set')
  const mainVariant = Array.isArray(draft?.data.variants) ? draft?.data.variants[0] as Record<string, unknown> : null

  return [
    {
      type: 'asset_set' as const,
      data: {
        channel: 'social',
        visualIntent: 'Support the message with one simple, high-contrast image direction.',
        suggestedHeadline: mainVariant?.hook ?? context.input.topic ?? 'Untitled',
        palette: context.brand.visual.palette,
      },
    },
  ]
}

function findArtifact(artifacts: ArtifactRecord[], type: ArtifactType): ArtifactRecord | undefined {
  return artifacts.find((artifact) => artifact.type === type)
}

function cloneArtifactData(data: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
}

export class Runtime {
  private readonly root?: string
  private readonly db = openRuntimeDb(this.root)
  private readonly paths = resolveRuntimePaths(this.root)

  constructor(options: RuntimeOptions = {}) {
    this.root = options.root
    ensureRuntimePaths(this.paths)
  }

  runWorkflow(input: RunWorkflowInput): RunRecord {
    const brand = loadBrandFoundation(input.brand, { root: this.paths.root })
    const runId = createId('run')
    const createdAt = nowIso()
    const run: RunRecord = {
      id: runId,
      workflow: input.workflow,
      brand: input.brand,
      status: 'in_review',
      input: input.input,
      currentStep: WORKFLOWS[input.workflow][WORKFLOWS[input.workflow].length - 1].name,
      createdAt,
      updatedAt: createdAt,
    }

    this.insertRun(run)
    this.executeWorkflow(run, brand, [], 0)
    return this.getRun(runId)
  }

  inspectRun(runId: string): RunDetails {
    return {
      run: this.getRun(runId),
      artifacts: this.listArtifacts(runId),
    }
  }

  listReviewRuns(): RunRecord[] {
    const rows = this.db.prepare(
      `SELECT * FROM runs WHERE status = 'in_review' ORDER BY created_at DESC`,
    ).all() as Array<Record<string, unknown>>
    return rows.map((row) => this.rowToRun(row))
  }

  reviewRun(runId: string, input: ReviewInput): RunRecord {
    const run = this.getRun(runId)
    const status: RunStatus = input.decision === 'approve' ? 'approved' : 'rejected'

    this.writeArtifact(runId, 'approval', 'review', {
      decision: input.decision,
      note: input.note ?? null,
      selectedVariantId: input.selectedVariantId ?? null,
    })

    this.updateRun(runId, status, 'review')
    return this.getRun(runId)
  }

  publishRun(runId: string): RunRecord {
    const run = this.getRun(runId)
    if (run.status !== 'approved') {
      throw new Error(`Run ${runId} must be approved before publish`)
    }

    const artifacts = this.listArtifacts(runId)
    const channel = workflowChannel(run.workflow)
    const payload: Record<string, unknown> = {
      workflow: run.workflow,
      channel,
      simulated: true,
    }

    if (run.workflow === 'blog.post') {
      const article = findArtifact(artifacts, 'article_draft')
      const exportPath = join(this.paths.exportsDir, `${runId}.md`)
      ensureParentDir(exportPath)
      writeFileSync(exportPath, String(article?.data.markdown ?? ''), 'utf8')
      payload.exportPath = exportPath
    }

    this.writeArtifact(runId, 'delivery', 'publish', payload)
    this.updateRun(runId, 'published', 'publish')
    return this.getRun(runId)
  }

  retryRun(runId: string, input: RetryInput): RunRecord {
    const original = this.getRun(runId)
    const brand = loadBrandFoundation(original.brand, { root: this.paths.root })
    const createdAt = nowIso()
    const newRun: RunRecord = {
      id: createId('run'),
      workflow: original.workflow,
      brand: original.brand,
      status: 'in_review',
      input: {
        ...original.input,
        retry: {
          fromRunId: runId,
          fromStep: input.fromStep,
        },
      },
      currentStep: WORKFLOWS[original.workflow][WORKFLOWS[original.workflow].length - 1].name,
      createdAt,
      updatedAt: createdAt,
      parentRunId: runId,
    }

    this.insertRun(newRun)

    const originalArtifacts = this.listArtifacts(runId)
    const startIndex = selectStepIndex(original.workflow, input.fromStep)
    const reused = originalArtifacts
      .filter((artifact) => {
        const stepIndex = WORKFLOWS[original.workflow].findIndex((step) => step.name === artifact.step)
        return stepIndex > -1 && stepIndex < startIndex
      })
      .map((artifact) => ({
        type: artifact.type,
        step: artifact.step,
        data: cloneArtifactData(artifact.data),
      }))

    for (const artifact of reused) {
      this.writeArtifact(newRun.id, artifact.type, artifact.step, artifact.data)
    }

    const priorArtifacts = this.listArtifacts(newRun.id)
    this.executeWorkflow(newRun, brand, priorArtifacts, startIndex)
    return this.getRun(newRun.id)
  }

  health(): Record<string, unknown> {
    return {
      root: this.paths.root,
      dbPath: this.paths.dbPath,
      brandsDir: this.paths.brandsDir,
      stateDir: this.paths.stateDir,
      reviewRuns: this.listReviewRuns().length,
    }
  }

  private executeWorkflow(
    run: RunRecord,
    brand: BrandFoundation,
    seedArtifacts: ArtifactRecord[],
    startIndex: number,
  ): void {
    let priorArtifacts = [...seedArtifacts]
    const steps = WORKFLOWS[run.workflow]

    for (const step of steps.slice(startIndex)) {
      const outputs = step.run({
        brand,
        workflow: run.workflow,
        runId: run.id,
        input: run.input,
        priorArtifacts,
      })

      for (const output of outputs) {
        this.writeArtifact(run.id, output.type, step.name, output.data)
      }

      priorArtifacts = this.listArtifacts(run.id)
      this.updateRun(run.id, 'in_review', step.name)
    }
  }

  private insertRun(run: RunRecord): void {
    this.db.prepare(`
      INSERT INTO runs (id, workflow, brand, status, input_json, current_step, created_at, updated_at, parent_run_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.workflow,
      run.brand,
      run.status,
      JSON.stringify(run.input),
      run.currentStep,
      run.createdAt,
      run.updatedAt,
      run.parentRunId ?? null,
    )
  }

  private updateRun(runId: string, status: RunStatus, currentStep: StepName): void {
    this.db.prepare(`
      UPDATE runs
      SET status = ?, current_step = ?, updated_at = ?
      WHERE id = ?
    `).run(status, currentStep, nowIso(), runId)
  }

  private writeArtifact(runId: string, type: ArtifactType, step: StepName, data: Record<string, unknown>): ArtifactRecord {
    const artifactId = createId('artifact')
    const path = join(this.paths.artifactsDir, runId, `${artifactId}.json`)
    const createdAt = nowIso()

    ensureParentDir(path)
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
    this.db.prepare(`
      INSERT INTO artifacts (id, run_id, type, step, path, created_at, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(artifactId, runId, type, step, path, createdAt, JSON.stringify(data))

    return {
      id: artifactId,
      runId,
      type,
      step,
      path,
      createdAt,
      data,
    }
  }

  private listArtifacts(runId: string): ArtifactRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM artifacts
      WHERE run_id = ?
      ORDER BY created_at ASC
    `).all(runId) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      type: row.type as ArtifactType,
      step: row.step as StepName,
      path: String(row.path),
      createdAt: String(row.created_at),
      data: JSON.parse(String(row.data_json)) as Record<string, unknown>,
    }))
  }

  private getRun(runId: string): RunRecord {
    const row = this.db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as Record<string, unknown> | undefined
    if (!row) {
      throw new Error(`Run not found: ${runId}`)
    }
    return this.rowToRun(row)
  }

  private rowToRun(row: Record<string, unknown>): RunRecord {
    return {
      id: String(row.id),
      workflow: row.workflow as WorkflowName,
      brand: String(row.brand),
      status: row.status as RunStatus,
      input: JSON.parse(String(row.input_json)) as Record<string, unknown>,
      currentStep: row.current_step as StepName,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      parentRunId: row.parent_run_id ? String(row.parent_run_id) : undefined,
    }
  }
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  return new Runtime(options)
}
