import type { PipelineResult } from '../intel/pipeline'
import type { EvalResult } from '../eval/grader'
import type { Learnings } from '../eval/learnings'
import type { PostSummary } from '../commands/post'
import type { QueueListResult, QueueShowResult } from '../commands/queue'
import type { ExploreResult } from '../commands/explore'
import type { VideoResult } from '../commands/video'
import type { BrandInitResult } from '../commands/brand'
import type { CopyCommandResult } from '../commands/copy-cmd'
import type { ImageCommandResult } from '../commands/image-cmd'
import type { PosterCommandResult } from '../commands/poster-cmd'
import type { EnqueueCommandResult } from '../commands/enqueue-cmd'

export type CommandData =
  | PipelineResult
  | ExploreResult
  | PostSummary
  | QueueListResult
  | QueueShowResult
  | EvalResult
  | Learnings
  | VideoResult
  | BrandInitResult
  | CopyCommandResult
  | ImageCommandResult
  | PosterCommandResult
  | EnqueueCommandResult
  | null

export interface CommandResult<T = CommandData> {
  status: 'ok'
  command: string
  data?: T
}

export interface ErrorResult {
  status: 'error'
  command?: string
  error: {
    message: string
    code: string
    details?: unknown
  }
}
