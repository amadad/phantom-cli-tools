/**
 * Simple rate limiter for API calls
 * Prevents hitting platform rate limits
 */

interface RateLimitConfig {
  requestsPerWindow: number
  windowMs: number
}

interface RateLimitState {
  requests: number[]
}

// Platform-specific rate limits (conservative estimates)
const PLATFORM_LIMITS: Record<string, RateLimitConfig> = {
  twitter: { requestsPerWindow: 15, windowMs: 15 * 60 * 1000 },    // 15 per 15 min
  linkedin: { requestsPerWindow: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100 per day
  facebook: { requestsPerWindow: 200, windowMs: 60 * 60 * 1000 },  // 200 per hour
  instagram: { requestsPerWindow: 25, windowMs: 24 * 60 * 60 * 1000 }, // 25 per day
  threads: { requestsPerWindow: 250, windowMs: 24 * 60 * 60 * 1000 },  // 250 per day
  youtube: { requestsPerWindow: 10000, windowMs: 24 * 60 * 60 * 1000 }, // quota-based
  default: { requestsPerWindow: 10, windowMs: 60 * 1000 }
}

// In-memory state (resets on process restart)
const state: Map<string, RateLimitState> = new Map()

/**
 * Get rate limit config for a platform
 */
function getConfig(platform: string): RateLimitConfig {
  return PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.default
}

/**
 * Get state for a platform+brand combination
 */
function getState(key: string): RateLimitState {
  if (!state.has(key)) {
    state.set(key, { requests: [] })
  }
  return state.get(key)!
}

/**
 * Clean up old requests outside the window
 */
function cleanupOldRequests(requests: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs
  return requests.filter(t => t > cutoff)
}

/**
 * Check if we can make a request (without consuming)
 */
export function canMakeRequest(platform: string, brand: string): boolean {
  const config = getConfig(platform)
  const key = `${platform}:${brand}`
  const s = getState(key)

  const cleanedRequests = cleanupOldRequests(s.requests, config.windowMs)
  return cleanedRequests.length < config.requestsPerWindow
}

/**
 * Record a request and check rate limit
 * Returns true if request was allowed, false if rate limited
 */
export function checkRateLimit(platform: string, brand: string): {
  allowed: boolean
  waitMs?: number
  remaining?: number
} {
  const config = getConfig(platform)
  const key = `${platform}:${brand}`
  const s = getState(key)

  // Clean up old requests
  s.requests = cleanupOldRequests(s.requests, config.windowMs)

  if (s.requests.length >= config.requestsPerWindow) {
    // Rate limited - calculate wait time
    const oldestRequest = Math.min(...s.requests)
    const waitMs = oldestRequest + config.windowMs - Date.now()
    return {
      allowed: false,
      waitMs: Math.max(0, waitMs),
      remaining: 0
    }
  }

  // Record this request
  s.requests.push(Date.now())

  return {
    allowed: true,
    remaining: config.requestsPerWindow - s.requests.length
  }
}

/**
 * Wait for rate limit to clear
 */
export async function waitForRateLimit(platform: string, brand: string): Promise<void> {
  const result = checkRateLimit(platform, brand)

  if (!result.allowed && result.waitMs) {
    console.log(`[rate-limit] ${platform}/${brand} rate limited, waiting ${Math.ceil(result.waitMs / 1000)}s...`)
    await new Promise(resolve => setTimeout(resolve, result.waitMs))
    // Retry after waiting
    return waitForRateLimit(platform, brand)
  }
}

/**
 * Decorator to wrap a function with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  platform: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    // Extract brand from first argument if it's the brand parameter
    const brand = typeof args[0] === 'string' ? args[0] : 'default'

    const result = checkRateLimit(platform, brand)
    if (!result.allowed) {
      throw new Error(
        `Rate limited on ${platform}. Wait ${Math.ceil((result.waitMs || 0) / 1000)} seconds.`
      )
    }

    return fn(...args)
  }) as T
}

/**
 * Get current rate limit status for a platform
 */
export function getRateLimitStatus(platform: string, brand: string): {
  remaining: number
  total: number
  resetsIn: number
} {
  const config = getConfig(platform)
  const key = `${platform}:${brand}`
  const s = getState(key)

  const cleanedRequests = cleanupOldRequests(s.requests, config.windowMs)
  const remaining = Math.max(0, config.requestsPerWindow - cleanedRequests.length)

  let resetsIn = 0
  if (cleanedRequests.length > 0) {
    const oldestRequest = Math.min(...cleanedRequests)
    resetsIn = Math.max(0, oldestRequest + config.windowMs - Date.now())
  }

  return {
    remaining,
    total: config.requestsPerWindow,
    resetsIn
  }
}
