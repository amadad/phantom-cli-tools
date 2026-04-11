import { createRuntime } from '../runtime/runtime'
import { confirmOrAbort } from '../lib/agent-cli'
import type { RunRecord } from '../domain/types'

type ReviewSummary = Pick<RunRecord, 'id' | 'status' | 'workflow' | 'brand' | 'createdAt'>

function parseIntFlag(args: string[], name: string, fallback?: number): number | undefined {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  const raw = args[index + 1]
  if (!raw) throw new Error(`Missing value for ${name}`)
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid value for ${name}: ${raw}`)
  }
  return value
}

function parseStringFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function toSummary(run: RunRecord): ReviewSummary {
  return {
    id: run.id,
    status: run.status,
    workflow: run.workflow,
    brand: run.brand,
    createdAt: run.createdAt,
  }
}

export async function runReviewCommand(args: string[], root?: string): Promise<unknown> {
  const [subcommand, ...rest] = args
  const runtime = createRuntime({ root })

  if (subcommand === 'list') {
    const limit = parseIntFlag(rest, '--limit', 25) as number
    const offset = parseIntFlag(rest, '--offset', 0) as number
    const full = rest.includes('--full')
    const runs = runtime.listReviewRuns({ limit, offset })
    if (full) {
      return { runs, limit, offset, count: runs.length }
    }
    return {
      runs: runs.map(toSummary),
      limit,
      offset,
      count: runs.length,
    }
  }

  const [runId] = rest

  if (subcommand === 'show') {
    if (!runId) throw new Error('Usage: review show <run_id>')
    return runtime.inspectRun(runId)
  }

  if (subcommand === 'approve') {
    if (!runId) throw new Error('Usage: review approve <run_id> [--note "..."] [--variant <id>] [--dry-run] [--yes]')
    const note = parseStringFlag(rest, '--note')
    const selectedVariantId = parseStringFlag(rest, '--variant')
    const dryRun = rest.includes('--dry-run')
    const yes = rest.includes('--yes')

    const proceed = await confirmOrAbort(`approve run ${runId}`, { dryRun, yes })
    if (!proceed) {
      return {
        dryRun: true,
        runId,
        action: 'approve',
        note: note ?? null,
        selectedVariantId: selectedVariantId ?? null,
      }
    }

    return runtime.reviewRun(runId, {
      decision: 'approve',
      note,
      selectedVariantId,
    })
  }

  if (subcommand === 'reject') {
    if (!runId) throw new Error('Usage: review reject <run_id> [--reason "..."] [--dry-run] [--yes]')
    const note = parseStringFlag(rest, '--reason')
    const dryRun = rest.includes('--dry-run')
    const yes = rest.includes('--yes')

    const proceed = await confirmOrAbort(`reject run ${runId}`, { dryRun, yes })
    if (!proceed) {
      return { dryRun: true, runId, action: 'reject', reason: note ?? null }
    }

    return runtime.reviewRun(runId, {
      decision: 'reject',
      note,
    })
  }

  throw new Error('Usage: review <list|show|approve|reject> ...')
}
