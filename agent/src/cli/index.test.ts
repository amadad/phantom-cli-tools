import { describe, it, expect, vi } from 'vitest'
import { runCli } from './index'

const mockCommand = vi.hoisted(() => ({
  name: 'dummy',
  summary: 'Dummy command',
  usage: 'dummy',
  run: vi.fn(async () => ({ hello: 'world' }))
}))

vi.mock('./registry', () => ({
  listCommands: () => [mockCommand],
  findCommand: (name: string) => (name === 'dummy' ? mockCommand : undefined)
}))

vi.mock('../core/paths', () => ({
  discoverBrands: () => ['brand-a']
}))

describe('runCli', () => {
  it('includes command data in json output', async () => {
    const writes: string[] = []
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        writes.push(String(chunk))
        return true
      })

    await runCli(['dummy', '--json'])

    stdoutSpy.mockRestore()

    const output = writes.join('').trim()
    const parsed = JSON.parse(output)

    expect(parsed).toEqual({
      status: 'ok',
      command: 'dummy',
      data: { hello: 'world' }
    })
  })
})
