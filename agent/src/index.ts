/**
 * Phantom Loom Agent
 * Background content pipeline for brand-driven social media
 *
 * @example
 * import { Pipeline, Monitor, Queue } from 'phantom-loom-agent'
 *
 * // Run pipeline for a topic
 * const result = await Pipeline.run({
 *   type: 'manual',
 *   topic: 'caregiver burnout',
 *   brandName: 'givecare'
 * })
 *
 * // Start monitoring feeds
 * Monitor.start([{ url: 'https://blog.example.com/feed', brandName: 'givecare' }])
 *
 * // Check queue
 * const pending = Queue.getPending()
 */

// Types
export type {
  Brand,
  ContentItem,
  QueueItem,
  ContentSource,
  PipelineStage,
  SourceType,
  FeedItem,
  MonitorConfig,
  PipelineConfig
} from './types'

// Queue operations
export {
  loadQueue,
  saveQueue,
  addToQueue,
  updateQueueItem,
  getQueueItem,
  removeFromQueue,
  getByStage,
  getPendingApproval,
  approveItem,
  rejectItem,
  getQueueStats
} from './queue'

// Pipeline
export { runPipeline, loadBrand, research, write, generateImage } from './pipeline/generate'

// RSS monitoring
export { checkFeed, checkAllFeeds, feedItemToSource, startMonitor } from './triggers/rss'

// Posting
export { postContent, postById, processPostQueue } from './social/post'
export type { PostResult } from './social/post'

// Convenience namespaces
import * as QueueModule from './queue'
import * as PipelineModule from './pipeline/generate'
import * as MonitorModule from './triggers/rss'
import * as PostModule from './social/post'

export const Queue = {
  load: QueueModule.loadQueue,
  add: QueueModule.addToQueue,
  update: QueueModule.updateQueueItem,
  get: QueueModule.getQueueItem,
  remove: QueueModule.removeFromQueue,
  getByStage: QueueModule.getByStage,
  getPending: QueueModule.getPendingApproval,
  approve: QueueModule.approveItem,
  reject: QueueModule.rejectItem,
  stats: QueueModule.getQueueStats
}

export const Pipeline = {
  run: PipelineModule.runPipeline,
  loadBrand: PipelineModule.loadBrand,
  research: PipelineModule.research,
  write: PipelineModule.write,
  generateImage: PipelineModule.generateImage
}

export const Monitor = {
  checkFeed: MonitorModule.checkFeed,
  checkAll: MonitorModule.checkAllFeeds,
  start: MonitorModule.startMonitor,
  feedItemToSource: MonitorModule.feedItemToSource
}

export const Post = {
  content: PostModule.postContent,
  byId: PostModule.postById,
  processQueue: PostModule.processPostQueue
}
