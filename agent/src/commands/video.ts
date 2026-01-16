/**
 * Video command - generate shorts from briefs
 *
 * Usage:
 *   npx tsx src/cli.ts video <brand> <brief-path> [options]
 *   npx tsx src/cli.ts video <brand> briefs/example.yml
 *
 * Options:
 *   --dry-run         Show what would be generated
 *   --skip-audio      Generate video without voice/audio
 *   --provider=<name> Video provider (replicate, runway, luma)
 */

import * as path from 'path'
import * as fs from 'fs'
import { generateVideoFromBrief } from '../video'
import { addToQueue } from '../queue'
import { getProjectRoot } from '../core/paths'
import type { CommandContext } from '../cli/types'

export interface VideoResult {
  brand: string
  provider: string
  outputDir: string
  brief: string
  scenes: number
  hasAudio: boolean
  dryRun: boolean
  queueId?: string
  videoPath?: string
  duration?: number
}

export async function run(args: string[], _ctx?: CommandContext): Promise<VideoResult> {
  // Parse arguments
  const brand = args[0]
  let briefPath = args[1]

  if (!brand || !briefPath) {
    console.error('Usage: video <brand> <brief-path> [options]')
    console.error('Example: video <brand> briefs/example.yml')
    throw new Error('Missing video arguments')
  }

  // Parse options
  const dryRun = args.includes('--dry-run')
  const skipAudio = args.includes('--skip-audio')

  let provider = 'replicate'
  const providerArg = args.find(a => a.startsWith('--provider='))
  if (providerArg) {
    provider = providerArg.split('=')[1]
  }

  // Resolve brief path
  const projectRoot = getProjectRoot()

  // Check multiple locations for brief
  const possiblePaths = [
    briefPath,
    path.join(projectRoot, 'agent', 'src', 'video', briefPath),
    path.join(projectRoot, 'agent', 'src', 'video', 'briefs', briefPath),
    path.join(projectRoot, briefPath)
  ]

  let resolvedPath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      resolvedPath = p
      break
    }
  }

  if (!resolvedPath) {
    console.error(`Brief not found: ${briefPath}`)
    console.error('Searched in:', possiblePaths)
    throw new Error(`Brief not found: ${briefPath}`)
  }

  briefPath = resolvedPath

  // Create output directory
  const today = new Date().toISOString().slice(0, 10)
  const outputDir = path.join(projectRoot, 'output', today)

  console.log(`
========================================
 Video Generation Pipeline
========================================
Brand:    ${brand}
Brief:    ${briefPath}
Provider: ${provider}
Output:   ${outputDir}
Dry run:  ${dryRun}
Audio:    ${skipAudio ? 'disabled' : 'enabled'}
========================================
`)

  // Check required env vars
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Error: REPLICATE_API_TOKEN not set')
    throw new Error('REPLICATE_API_TOKEN not set')
  }

  if (!skipAudio && !process.env.CARTESIA_API_KEY) {
    console.error('Error: CARTESIA_API_KEY not set (use --skip-audio to generate without voice)')
    throw new Error('CARTESIA_API_KEY not set')
  }

  // Generate video
  const result = await generateVideoFromBrief({
    briefPath,
    outputDir,
    provider,
    skipAudio,
    dryRun
  })

  if (dryRun) {
    console.log('\n[dry-run] Would generate video with:')
    console.log(`  - ${result.scenes} scenes`)
    console.log(`  - Provider: ${provider}`)
    console.log(`  - Audio: ${skipAudio ? 'no' : 'yes'}`)
    return {
      brand,
      provider,
      outputDir,
      brief: briefPath,
      scenes: result.scenes,
      hasAudio: !skipAudio,
      dryRun: true
    }
  }

  // Add to queue
  console.log('\n[video] Adding to queue...')
  const queueId = `video_${brand}_${Date.now()}`

  await addToQueue({
    id: queueId,
    source: {
      type: 'video',
      topic: result.brief.meta.topic,
      brandName: brand
    },
    stage: 'review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: {
      topic: result.brief.meta.topic,
      youtube: {
        title: result.brief.meta.topic,
        description: result.brief.scenes.map(s => s.script).join(' '),
        tags: [brand, 'shorts']
      }
    },
    video: {
      url: result.videoPath,
      duration: result.duration,
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      provider,
      hasAudio: !skipAudio
    }
  })

  console.log(`
========================================
 Complete
========================================
Video:    ${result.videoPath}
Duration: ${result.duration.toFixed(2)}s
Scenes:   ${result.scenes}
Queue:    Added (stage: review)
========================================

Next: npx tsx src/cli.ts post ${brand} --id=${queueId}
`)

  return {
    brand,
    queueId,
    provider,
    outputDir,
    brief: briefPath,
    videoPath: result.videoPath,
    duration: result.duration,
    scenes: result.scenes,
    hasAudio: !skipAudio,
    dryRun
  }
}
