import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs before importing queue module
const mockFs: Record<string, string> = {}
vi.mock('fs', () => ({
  existsSync: (path: string) => path in mockFs,
  readFileSync: (path: string, _enc?: string) => {
    if (!(path in mockFs)) throw new Error(`ENOENT: ${path}`)
    return mockFs[path]
  },
  writeFileSync: (path: string, data: string) => { mockFs[path] = data },
  renameSync: (src: string, dest: string) => {
    mockFs[dest] = mockFs[src]
    delete mockFs[src]
  },
}))

vi.mock('../core/paths', () => ({
  getBrandDir: (brand: string) => `/brands/${brand}`,
  discoverBrands: () => ['testbrand'],
}))

import { loadQueue, addToQueue } from './index'

beforeEach(() => {
  for (const key of Object.keys(mockFs)) delete mockFs[key]
})

describe('loadQueue', () => {
  it('returns [] when file does not exist', () => {
    expect(loadQueue('testbrand')).toEqual([])
  })

  it('returns [] for empty file', () => {
    mockFs['/brands/testbrand/queue.json'] = ''
    expect(loadQueue('testbrand')).toEqual([])
  })

  it('parses valid JSON array', () => {
    mockFs['/brands/testbrand/queue.json'] = JSON.stringify([{ id: 'x' }])
    expect(loadQueue('testbrand')).toEqual([{ id: 'x' }])
  })

  it('throws on malformed JSON instead of silently returning []', () => {
    // Regression: previously returned [] on parse failure,
    // which would wipe the queue on next write
    mockFs['/brands/testbrand/queue.json'] = '{ broken json'
    expect(() => loadQueue('testbrand')).toThrow(/Corrupt queue file/)
  })

  it('throws when file contains non-array JSON', () => {
    mockFs['/brands/testbrand/queue.json'] = '{"not": "an array"}'
    expect(() => loadQueue('testbrand')).toThrow(/Expected array/)
  })
})
