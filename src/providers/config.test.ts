import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { getProvider } from './config'

describe('Provider Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw error when API key is missing', () => {
    delete process.env.OPENAI_API_KEY
    expect(() => getProvider()).toThrow('OPENAI_API_KEY environment variable is required')
  })

  it('should use custom gateway when AI_GATEWAY is set', () => {
    process.env.AI_GATEWAY = 'https://custom-gateway.com'
    const provider = getProvider()
    expect(provider).toBeDefined()
  })

  it('should use default OpenAI when AI_GATEWAY is not set', () => {
    delete process.env.AI_GATEWAY
    const provider = getProvider()
    expect(provider).toBeDefined()
  })

  it('should return a function that accepts model and options', () => {
    const provider = getProvider()
    const modelFn = provider('gpt-4o-mini')
    expect(modelFn).toBeDefined()
  })

  it('should handle structured outputs option', () => {
    const provider = getProvider()
    const modelFn = provider('gpt-4o-mini', { structuredOutputs: true })
    expect(modelFn).toBeDefined()
  })
}) 