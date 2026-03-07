/**
 * Safe JSON parsing utilities
 */

/**
 * Safely parse JSON with detailed error messages
 */
export function safeJsonParse<T>(
  jsonString: string,
  context?: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(jsonString) as T
    return { success: true, data }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const preview = jsonString.slice(0, 100).replace(/\n/g, '\\n')
    return {
      success: false,
      error: `JSON parse error${context ? ` (${context})` : ''}: ${errorMessage}. Preview: ${preview}...`
    }
  }
}

/**
 * Extract and parse JSON from a string that may contain other text
 * Useful for parsing LLM responses that include JSON
 */
export function extractJson<T>(
  text: string,
  context?: string
): { success: true; data: T } | { success: false; error: string } {
  // Try to find JSON object — greedy first (handles nested), non-greedy fallback (handles multi-object)
  const greedyObject = text.match(/\{[\s\S]*\}/)
  if (greedyObject) {
    const result = safeJsonParse<T>(greedyObject[0], context)
    if (result.success) return result
  }
  const nonGreedyObject = text.match(/\{[\s\S]*?\}/)
  if (nonGreedyObject) {
    const result = safeJsonParse<T>(nonGreedyObject[0], context)
    if (result.success) return result
  }

  // Try to find JSON array — greedy first, non-greedy fallback
  const greedyArray = text.match(/\[[\s\S]*\]/)
  if (greedyArray) {
    const result = safeJsonParse<T>(greedyArray[0], context)
    if (result.success) return result
  }
  const nonGreedyArray = text.match(/\[[\s\S]*?\]/)
  if (nonGreedyArray) {
    const result = safeJsonParse<T>(nonGreedyArray[0], context)
    if (result.success) return result
  }

  return {
    success: false,
    error: `No JSON found in text${context ? ` (${context})` : ''}. Preview: ${text.slice(0, 100)}...`
  }
}

