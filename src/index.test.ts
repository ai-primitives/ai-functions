import { describe, expect, it } from 'vitest'
import { ai } from './index'
import { z } from 'zod'
import type { AIFunctionOptions } from './types'

describe('ai template tag', () => {
  it('should support basic template literals', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`
    expect(typeof result).toBe('string')
  })

  it('should support configuration object', async () => {
    const name = 'World'
    const config: AIFunctionOptions = {
      model: 'gpt-3.5-turbo',
    }
    const result = await ai`Hello ${name}${config}`
    expect(typeof result).toBe('string')
  })

  it('should support JSON output with schema', async () => {
    const schema = z.object({
      greeting: z.string(),
      timestamp: z.number(),
    })

    const config: AIFunctionOptions = {
      outputFormat: 'json',
      schema,
    }
    const result = await ai`Generate a greeting${config}`
    const parsed = schema.parse(result)
    expect(parsed).toBeDefined()
    expect(typeof parsed.greeting).toBe('string')
    expect(typeof parsed.timestamp).toBe('number')
  })

  it('should support streaming responses', async () => {
    const chunks = ['Item 1', 'Item 2', 'Item 3']
    const collected: string[] = []

    const stream = ai`List some items`
    for await (const chunk of stream) {
      collected.push(chunk.trim())
    }

    expect(collected).toEqual(chunks)
  })
})
