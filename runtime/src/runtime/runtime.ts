import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { DatabaseSync } from 'node:sqlite'
import { loadBrandFoundation } from '../brands/load'
import { loadRuntimeEnv } from '../core/env'
import { ensureParentDir, ensureRuntimePaths, resolveRuntimePaths, type RuntimePaths } from '../core/paths'
import { createId, nowIso } from '../core/ids'
import { buildSocialPublishPlan, publishSocialPost, type SocialPublisher } from '../publish/social'
import {
  WORKFLOWS,
  cloneArtifactData,
  findArtifact,
  formatSocialPostText,
  selectStepIndex,
  workflowChannel,
  type WorkflowContext,
} from './steps'
import type {
  ArtifactRecord,
  ArtifactType,
  BrandFoundation,
  PublishInput,
  RetryInput,
  ReviewInput,
  RunDetails,
  RunRecord,
  RunWorkflowInput,
  RunStatus,
  SocialPlatform,
  StepName,
} from '../domain/types'
import { openRuntimeDb } from './db'

interface RuntimeOptions {
  root?: string
  socialPublisher?: SocialPublisher
}

export class Runtime {
  private readonly root?: string
  private readonly db: DatabaseSync
  private readonly paths: RuntimePaths
  private socialPublisher: SocialPublisher

  constructor(options: RuntimeOptions = {}) {
    this.root = options.root
    this.paths = resolveRuntimePaths(this.root)
    loadRuntimeEnv(this.paths.root)
    ensureRuntimePaths(this.paths)
    this.db = openRuntimeDb(this.paths.root)
    this.socialPublisher = options.socialPublisher ?? publishSocialPost
  }

  async runWorkflow(input: RunWorkflowInput): Promise<RunRecord> {
    const brand = loadBrandFoundation(input.brand, { root: this.paths.root })
    const runId = createId('run')
    const createdAt = nowIso()
    const steps = WORKFLOWS[input.workflow]
    const run: RunRecord = {
      id: runId,
      workflow: input.workflow,
      brand: input.brand,
      status: 'in_review',
      input: input.input,
      currentStep: steps[steps.length - 1].name,
      createdAt,
      updatedAt: createdAt,
    }

    this.insertRun(run)
    await this.executeWorkflow(run, brand, [], 0)
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

  setSocialPublisher(publisher: SocialPublisher): void {
    this.socialPublisher = publisher
  }

  async publishRun(runId: string, input: PublishInput = {}): Promise<RunRecord> {
    const run = this.getRun(runId)
    if (run.status === 'published') {
      return run
    }
    if (run.status !== 'approved') {
      throw new Error(`Run ${runId} must be approved before publish`)
    }

    const artifacts = this.listArtifacts(runId)
    const channel = workflowChannel(run.workflow)
    const payload: Record<string, unknown> = {
      workflow: run.workflow,
      channel,
      simulated: run.workflow !== 'social.post',
    }

    if (run.workflow === 'social.post') {
      const draft = findArtifact(artifacts, 'draft_set')
      const assetSet = findArtifact(artifacts, 'asset_set')
      const approval = findArtifact([...artifacts].reverse(), 'approval')
      const variants = Array.isArray(draft?.data.variants) ? draft.data.variants as Array<Record<string, unknown>> : []
      const selectedVariantId = typeof approval?.data.selectedVariantId === 'string'
        ? approval.data.selectedVariantId
        : undefined
      const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0]
      if (!selectedVariant) {
        throw new Error(`Run ${runId} has no social draft variant to publish`)
      }

      const platformAssets = assetSet?.data.platformAssets && typeof assetSet.data.platformAssets === 'object'
        ? assetSet.data.platformAssets as Record<SocialPlatform, string>
        : undefined
      if (!platformAssets) {
        throw new Error(`Run ${runId} has no platform assets to publish`)
      }

      const plan = buildSocialPublishPlan(run.brand, input)
      const results = await this.socialPublisher({
        brand: run.brand,
        text: formatSocialPostText(selectedVariant),
        platformAssets,
        platforms: plan.platforms,
        dryRun: input.dryRun,
        root: this.paths.root,
      })

      const allSucceeded = results.every((result) => result.success)
      payload.platforms = plan.platforms
      payload.results = results
      payload.selectedVariantId = selectedVariant.id ?? null
      payload.text = formatSocialPostText(selectedVariant)
      payload.imagePath = typeof assetSet?.data.imagePath === 'string' ? assetSet.data.imagePath : null
      payload.platformAssets = platformAssets
      payload.auth = plan.auth
      payload.simulated = false
      payload.dryRun = Boolean(input.dryRun)

      this.writeArtifact(runId, 'delivery', 'publish', payload)
      const status: RunStatus = input.dryRun ? 'approved' : allSucceeded ? 'published' : 'approved'
      const step: StepName = input.dryRun ? 'review' : allSucceeded ? 'publish' : 'review'
      this.updateRun(runId, status, step)
      return this.getRun(runId)
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

  async retryRun(runId: string, input: RetryInput): Promise<RunRecord> {
    const original = this.getRun(runId)
    const brand = loadBrandFoundation(original.brand, { root: this.paths.root })
    const createdAt = nowIso()
    const steps = WORKFLOWS[original.workflow]
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
      currentStep: steps[steps.length - 1].name,
      createdAt,
      updatedAt: createdAt,
      parentRunId: runId,
    }

    this.insertRun(newRun)

    const originalArtifacts = this.listArtifacts(runId)
    const startIndex = selectStepIndex(original.workflow, input.fromStep)
    const reused = originalArtifacts
      .filter((artifact) => {
        const stepIndex = steps.findIndex((step) => step.name === artifact.step)
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
    await this.executeWorkflow(newRun, brand, priorArtifacts, startIndex)
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

  private async executeWorkflow(
    run: RunRecord,
    brand: BrandFoundation,
    seedArtifacts: ArtifactRecord[],
    startIndex: number,
  ): Promise<void> {
    let priorArtifacts = [...seedArtifacts]
    const steps = WORKFLOWS[run.workflow]

    for (const step of steps.slice(startIndex)) {
      const outputs = await step.run({
        brand,
        workflow: run.workflow,
        runId: run.id,
        input: run.input,
        priorArtifacts,
        paths: this.paths,
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
      workflow: row.workflow as RunRecord['workflow'],
      brand: String(row.brand),
      status: row.status as RunRecord['status'],
      input: JSON.parse(String(row.input_json)) as Record<string, unknown>,
      currentStep: row.current_step as RunRecord['currentStep'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      parentRunId: row.parent_run_id ? String(row.parent_run_id) : undefined,
    }
  }
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  return new Runtime(options)
}
