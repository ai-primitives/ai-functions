import { describe, expect, it, beforeEach } from 'vitest'
import { ai } from './index'
import { z } from 'zod'
import type { AIFunctionOptions, AsyncIterablePromise } from './types'
import { openai } from '@ai-sdk/openai'

describe('ai template tag', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini', { structuredOutputs: true })

  it('should support basic template literals', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support configuration object', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support JSON output with schema', async () => {
    const schema = z.object({
      greeting: z.string(),
      timestamp: z.number(),
    })

    const result = await ai`Generate a greeting with the current timestamp`({
      model,
      outputFormat: 'json',
      schema
    })
    const parsed = schema.parse(JSON.parse(result))
    expect(parsed).toBeDefined()
    expect(typeof parsed.greeting).toBe('string')
    expect(typeof parsed.timestamp).toBe('number')
  })

  it('should support streaming responses', async () => {
    const streamingModel = openai('gpt-4o', { 
      structuredOutputs: true
    })
    const response = ai`List some items`({ 
      model: streamingModel,
      streaming: {
        onProgress: () => {},
        enableTokenCounting: true
      }
    }) as AsyncIterablePromise<string>
    
    expect(typeof response[Symbol.asyncIterator]).toBe('function')
    const chunks: string[] = []
    for await (const chunk of response) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toMatch(/^[\s\S]+$/)
  })
})
