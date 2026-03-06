/**
 * Snowball command - Build 30 days of content from one seed topic
 *
 * Usage:
 *   snowball <brand> "<topic>" [--dry-run] [--json] [--limit N]
 */

import { GoogleGenAI } from '@google/genai'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { extractBrandTopic } from '../cli/args'
import { extractJson } from '../core/json'
import { withTimeout } from '../core/http'
import { run as runExplore } from './explore'
import type { CommandContext } from '../cli/types'

type ContentFormat = 'educational' | 'provocative' | 'caseStudy'

interface CoreProblem {
  coreProblem: string
  whyItMatters: string
  goals: string[]
  icp: Array<{
    who: string
    wants: string
    blockers: string
    language: string
    triggers: string
    taboos: string
  }>
}

interface Angle {
  angle: string
  hooks: string[]
  insight: string
  fact: string
  controversy: string
}

interface Branch {
  angle: string
  subtopic: string
  educational: string
  provocative: string
  caseStudy: string
}

interface CalendarDay {
  day: number
  date: string
  platform: string
  topic: string
  format: ContentFormat
  goal: string
  content: string
}

interface SnowballRow {
  day: number
  platform: string
  topic: string
  format: ContentFormat
  queueId: string
}

export interface SnowballResult {
  brand: string
  seedTopic: string
  dryRun: boolean
  limit: number
  savedPath: string
  core: CoreProblem
  angles: Angle[]
  branches: Branch[]
  calendar: CalendarDay[]
  summary: SnowballRow[]
}

const DEFAULT_LIMIT = 5
const TOTAL_DAYS = 30
const SNOWBALL_MODEL = 'gemini-3-flash-preview'
const OUTPUT_ROOT = '/home/deploy/oc-orb/content'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item))
    .filter((item) => item.length > 0)
}

function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) {
    throw new Error(`Invalid --limit value "${raw}". Expected an integer >= 0.`)
  }
  return Math.min(TOTAL_DAYS, n)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function normalizeFormat(value: string): ContentFormat {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'provocative') return 'provocative'
  if (normalized === 'casestudy') return 'caseStudy'
  return 'educational'
}

function fallbackFormat(index: number): ContentFormat {
  const cycle: ContentFormat[] = ['educational', 'provocative', 'caseStudy']
  return cycle[index % cycle.length]
}

function fallbackPlatform(index: number): string {
  const cycle = ['instagram', 'linkedin', 'threads', 'twitter']
  return cycle[index % cycle.length]
}

function fallbackGoal(format: ContentFormat): string {
  if (format === 'educational') return 'teach'
  if (format === 'provocative') return 'engage'
  return 'credibility'
}

function normalizeCoreProblem(raw: unknown): CoreProblem {
  const record = asRecord(raw)
  if (!record) throw new Error('Step 1 returned invalid JSON shape')

  const icpRaw = Array.isArray(record.icp) ? record.icp : []
  const icp = icpRaw.map((item) => {
    const r = asRecord(item) || {}
    return {
      who: asString(r.who),
      wants: asString(r.wants),
      blockers: asString(r.blockers),
      language: asString(r.language),
      triggers: asString(r.triggers),
      taboos: asString(r.taboos)
    }
  })

  const coreProblem = asString(record.coreProblem)
  if (!coreProblem) throw new Error('Step 1 did not include coreProblem')

  return {
    coreProblem,
    whyItMatters: asString(record.whyItMatters),
    goals: asStringArray(record.goals),
    icp
  }
}

function normalizeAngles(raw: unknown): Angle[] {
  let source: unknown[] = []
  if (Array.isArray(raw)) {
    source = raw
  } else {
    const record = asRecord(raw)
    if (record?.angles && Array.isArray(record.angles)) source = record.angles
    else if (record) source = [record]
  }

  const angles = source
    .map((item) => {
      const r = asRecord(item) || {}
      return {
        angle: asString(r.angle),
        hooks: asStringArray(r.hooks).slice(0, 2),
        insight: asString(r.insight),
        fact: asString(r.fact),
        controversy: asString(r.controversy)
      }
    })
    .filter((item) => item.angle.length > 0)

  if (angles.length === 0) throw new Error('Step 2 returned no usable angles')
  return angles.slice(0, 7)
}

function normalizeBranches(raw: unknown): Branch[] {
  let source: unknown[] = []
  if (Array.isArray(raw)) {
    source = raw
  } else {
    const record = asRecord(raw)
    if (record?.branches && Array.isArray(record.branches)) source = record.branches
  }

  const branches = source
    .map((item) => {
      const r = asRecord(item) || {}
      return {
        angle: asString(r.angle),
        subtopic: asString(r.subtopic),
        educational: asString(r.educational),
        provocative: asString(r.provocative),
        caseStudy: asString(r.caseStudy)
      }
    })
    .filter((item) => item.subtopic.length > 0)

  if (branches.length === 0) throw new Error('Step 3 returned no usable branches')
  return branches
}

function extractCalendarArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const record = asRecord(raw)
  if (record?.calendar && Array.isArray(record.calendar)) return record.calendar
  return []
}

function selectBranchContent(branch: Branch, format: ContentFormat): string {
  if (format === 'provocative') return branch.provocative || branch.educational || branch.caseStudy
  if (format === 'caseStudy') return branch.caseStudy || branch.educational || branch.provocative
  return branch.educational || branch.provocative || branch.caseStudy
}

function normalizeCalendar(raw: unknown, branches: Branch[]): CalendarDay[] {
  const rows = extractCalendarArray(raw)
  if (rows.length === 0) throw new Error('Step 4 returned no calendar rows')
  if (branches.length === 0) throw new Error('Cannot build calendar without branches')

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const calendar: CalendarDay[] = []
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const source = asRecord(rows[i % rows.length]) || {}
    const branch = branches[i % branches.length]
    const format = normalizeFormat(asString(source.format, fallbackFormat(i)))
    const day = i + 1
    const date = formatDate(addDays(start, i))
    const topic = asString(source.topic) || asString(source.subtopic) || branch.subtopic || `Day ${day} topic`
    const content = asString(source.content) || selectBranchContent(branch, format)

    calendar.push({
      day,
      date,
      platform: asString(source.platform, fallbackPlatform(i)),
      topic,
      format,
      goal: asString(source.goal, fallbackGoal(format)),
      content
    })
  }

  return calendar
}

function sanitizeBrandForFilename(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'brand'
}

function truncate(text: string, max = 48): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

function printSummaryTable(rows: SnowballRow[]): void {
  console.log('\n[snowball] Summary')
  console.log('day | platform  | topic                                            | format      | queueId')
  console.log('----+-----------+--------------------------------------------------+-------------+----------------------------')
  for (const row of rows) {
    const day = String(row.day).padStart(2, '0')
    const platform = row.platform.padEnd(9, ' ')
    const topic = truncate(row.topic).padEnd(50, ' ')
    const format = row.format.padEnd(11, ' ')
    console.log(`${day} | ${platform} | ${topic} | ${format} | ${row.queueId}`)
  }
}

async function generateStepJson<T>(ai: GoogleGenAI, prompt: string, step: string): Promise<T> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: SNOWBALL_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingLevel: 'low' } } as any
    }),
    45_000,
    `Snowball ${step}`
  )

  const parts = response.candidates?.[0]?.content?.parts || []
  const text = parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()

  if (!text) throw new Error(`Step "${step}" returned empty response`)

  const parsed = extractJson<T>(text, `snowball ${step}`)
  if (!parsed.success) throw new Error(parsed.error)
  return parsed.data
}

export async function run(args: string[], ctx?: CommandContext): Promise<SnowballResult> {
  const parsed = extractBrandTopic(args, ['limit'])
  if (!parsed.topic) {
    throw new Error('Missing topic. Usage: snowball <brand> "<topic>" [--dry-run] [--limit N]')
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const brand = parsed.brand
  const seedTopic = parsed.topic
  const dryRun = parsed.booleans.has('dry-run')
  const limit = parseLimit(parsed.flags.limit)

  console.log(`\n[snowball] Brand: ${brand}`)
  console.log(`[snowball] Seed topic: "${seedTopic}"`)
  console.log(`[snowball] Limit: ${limit}${dryRun ? ' (dry-run)' : ''}`)

  const ai = new GoogleGenAI({ apiKey })

  console.log('\n[snowball] Step 1/4: core problem')
  const corePrompt = `You are a content strategist for ${brand}. The seed topic is: ${seedTopic}. Define one core problem in this niche that people are actually willing to discuss and share. Output JSON: { coreProblem: string, whyItMatters: string, goals: string[], icp: [{ who, wants, blockers, language, triggers, taboos }] }.

Return only valid JSON.`
  const core = normalizeCoreProblem(await generateStepJson<unknown>(ai, corePrompt, 'core'))

  console.log('\n[snowball] Step 2/4: angles')
  const anglesPrompt = `Take this core problem: ${core.coreProblem}. Propose 7 unexpected angles (counterintuitive, you-are-doing-it-wrong, myth vs reality, hidden cost). For each angle output JSON: { angle: string, hooks: [string, string], insight: string, fact: string, controversy: string }.

Return a JSON array of exactly 7 objects and nothing else.`
  const angles = normalizeAngles(await generateStepJson<unknown>(ai, anglesPrompt, 'angles'))

  console.log('\n[snowball] Step 3/4: branches')
  const anglesForPrompt = JSON.stringify(angles)
  const branchesPrompt = `For each of these 7 angles: ${anglesForPrompt}. Create 3 subtopics each. For each subtopic create 3 formats: educational (hook + insight + 3 steps), provocative (debatable hook + 3 proofs + question), case study (context + action + numbers + takeaway). Output JSON array: [{ angle, subtopic, educational: string, provocative: string, caseStudy: string }].

Return only valid JSON.`
  const branches = normalizeBranches(await generateStepJson<unknown>(ai, branchesPrompt, 'branches'))

  console.log('\n[snowball] Step 4/4: calendar')
  const branchesForPrompt = JSON.stringify(branches)
  const calendarPrompt = `Using these branches: ${branchesForPrompt}. Build a 30-day content calendar. Output JSON array: [{ day: number, date: string (YYYY-MM-DD starting from today), platform: string, topic: string, format: "educational"|"provocative"|"caseStudy", goal: string, content: string }]. Avoid repetition. Alternate topics.

Return only valid JSON.`
  const calendar = normalizeCalendar(await generateStepJson<unknown>(ai, calendarPrompt, 'calendar'), branches)

  const today = formatDate(new Date())
  const outputPath = `${OUTPUT_ROOT}/snowball-${sanitizeBrandForFilename(brand)}-${today}.json`
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(calendar, null, 2))
  console.log(`\n[snowball] Saved calendar: ${outputPath}`)

  const queueByDay = new Map<number, string>()
  const exploreCount = dryRun ? 0 : Math.min(limit, calendar.length)

  if (!dryRun && exploreCount > 0) {
    console.log(`\n[snowball] Running explore() for first ${exploreCount} day(s)`)
    for (let i = 0; i < exploreCount; i++) {
      const day = calendar[i]
      console.log(`[snowball] Day ${day.day}: ${day.topic}`)
      try {
        const result = await runExplore([brand, day.topic], ctx)
        queueByDay.set(day.day, result.queueId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[snowball] Explore failed for day ${day.day}: ${message}`)
        queueByDay.set(day.day, 'ERROR')
      }
    }
  }

  const summary: SnowballRow[] = calendar.map((entry) => ({
    day: entry.day,
    platform: entry.platform,
    topic: entry.topic,
    format: entry.format,
    queueId: dryRun ? 'dry-run' : (queueByDay.get(entry.day) || '-')
  }))

  if (ctx?.flags.json) {
    // No-op here; CLI wrapper will print return payload as JSON.
  } else {
    printSummaryTable(summary)
  }

  return {
    brand,
    seedTopic,
    dryRun,
    limit,
    savedPath: outputPath,
    core,
    angles,
    branches,
    calendar,
    summary
  }
}
