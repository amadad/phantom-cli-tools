import { describe, it, expect, vi } from 'vitest'
import { parseArgs } from './args'

// Mock discoverBrands to return known brands for the brand-detection test
vi.mock('../core/paths', () => ({
  discoverBrands: () => ['givecare', 'scty'],
  getDefaultBrand: () => 'givecare',
}))

describe('parseArgs', () => {
  it('two positionals: first = brand, rest = topic', () => {
    const result = parseArgs(['scty', 'caregiver burnout'])
    expect(result.brand).toBe('scty')
    expect(result.topic).toBe('caregiver burnout')
  })

  it('single positional matching a known brand: sets brand, not topic', () => {
    // Regression: previously a single positional always became topic,
    // causing wrong-brand writes when running e.g. `poster scty --image ... --headline ...`
    const result = parseArgs(['scty', '--image', '/tmp/a.png', '--headline', 'Hi'], ['image', 'headline'])
    expect(result.brand).toBe('scty')
    expect(result.flags.image).toBe('/tmp/a.png')
    expect(result.flags.headline).toBe('Hi')
  })

  it('single positional NOT matching a brand: becomes topic', () => {
    const result = parseArgs(['caregiver burnout'])
    expect(result.brand).toBe('givecare') // default
    expect(result.topic).toBe('caregiver burnout')
  })

  it('no positionals: default brand, empty topic', () => {
    const result = parseArgs(['--dry-run'])
    expect(result.brand).toBe('givecare')
    expect(result.topic).toBe('')
    expect(result.booleans.has('dry-run')).toBe(true)
  })

  it('--flag=value syntax', () => {
    const result = parseArgs(['scty', '--style=s09'])
    expect(result.flags.style).toBe('s09')
  })

  it('quoted topic overrides positional topic', () => {
    const result = parseArgs(['givecare', '"caregiver burnout"'])
    expect(result.topic).toBe('caregiver burnout')
  })
})
