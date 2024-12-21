import { describe, expect, it } from 'vitest'
import { ai } from './index'
import { z } from 'zod'
import type { AIFunctionOptions } from './types'
import { openai } from '@ai-sdk/openai'

describe('ai template tag', () => {
  const model = openai('gpt-4o-mini', { structuredOutputs: true })

  it('should support basic template literals', async () => {
    const name = 'World'
    const config: AIFunctionOptions = { model }
    const result = await ai`Hello ${name}${config}`
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support configuration object', async () => {
    const name = 'World'
    const config: AIFunctionOptions = {
      model,
    }
    const result = await ai`Hello ${name}${config}`
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support JSON output with schema', async () => {
    const schema = z.object({
      greeting: z.string(),
      timestamp: z.number(),
    })

    const config: AIFunctionOptions = {
      model,
      outputFormat: 'json',
      schema
    }
    const result = await ai`Generate a greeting with the current timestamp${config}`
    const parsed = schema.parse(JSON.parse(result))
    expect(parsed).toBeDefined()
    expect(typeof parsed.greeting).toBe('string')
    expect(typeof parsed.timestamp).toBe('number')
  })

  it('should support streaming responses', async () => {
    const config: AIFunctionOptions = { model }
    const stream = ai`List some items${config}`
    const collected: string[] = []

    for await (const chunk of stream) {
      collected.push(chunk.trim())
    }

    expect(collected.length).toBeGreaterThan(0)
    expect(collected.every(chunk => typeof chunk === 'string')).toBe(true)
  })
})
