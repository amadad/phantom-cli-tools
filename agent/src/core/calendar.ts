/**
 * Content calendar loading and theme selection
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'

interface ContentCalendar {
  brand: string
  frequency: string
  platforms: string[]
  themes: Record<string, string>
}

const calendarCache = new Map<string, ContentCalendar>()

/**
 * Load content calendar from YAML file
 */
export function loadCalendar(brandName: string): ContentCalendar | null {
  if (calendarCache.has(brandName)) {
    return calendarCache.get(brandName)!
  }

  const calendarPath = join(process.cwd(), '..', 'brands', brandName, 'calendar.yml')

  if (!existsSync(calendarPath)) {
    console.log(`[calendar] No calendar found for ${brandName}`)
    return null
  }

  const content = readFileSync(calendarPath, 'utf-8')
  const calendar = yaml.load(content) as ContentCalendar

  calendarCache.set(brandName, calendar)
  return calendar
}

/**
 * Get monthly theme for current date
 * Returns null if no theme defined (use hooks instead)
 */
export function getMonthlyTheme(brandName: string, date: Date = new Date()): string | null {
  const calendar = loadCalendar(brandName)
  if (!calendar?.themes) {
    return null
  }

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]

  const currentMonth = monthNames[date.getMonth()]
  const theme = calendar.themes[currentMonth]

  if (theme) {
    console.log(`[calendar] ${currentMonth}: ${theme}`)
    return theme
  }

  // Fallback: no theme for this month = use hooks
  console.log(`[calendar] ${currentMonth}: no theme, using hooks`)
  return null
}

/**
 * Clear calendar cache (useful for testing/reloading)
 */
export function clearCalendarCache(): void {
  calendarCache.clear()
}
