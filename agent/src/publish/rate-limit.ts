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

