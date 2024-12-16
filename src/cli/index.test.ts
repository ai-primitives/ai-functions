import { describe, it, expect, vi } from 'vitest'
import { parseArgs, showHelp, showVersion, cli } from './index'

describe('CLI', () => {
  it('should parse version flag correctly', () => {
    const options = parseArgs(['-v'])
    expect(options.version).toBe(true)

    const longOptions = parseArgs(['--version'])
    expect(longOptions.version).toBe(true)
  })

  it('should parse help flag correctly', () => {
    const options = parseArgs(['-h'])
    expect(options.help).toBe(true)

    const longOptions = parseArgs(['--help'])
    expect(longOptions.help).toBe(true)
  })

  it('should show version number', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    showVersion()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should show help message', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    showHelp()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should default to help when no arguments provided', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    cli([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
