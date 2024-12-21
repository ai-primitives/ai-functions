import { describe, expect, it } from 'vitest'
import { ai } from './index'
import { z } from 'zod'
import type { AsyncIterablePromise } from './types'

describe('ai template tag', () => {
  it('should support basic template literals', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`
    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe('string')
  })

  it('should support configuration object', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`({
      model: 'gpt-3.5-turbo',
    })
    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe('string')
  })

  it('should support JSON output with schema', async () => {
    const schema = z.object({
      greeting: z.string(),
      timestamp: z.number(),
    })

    const result = await ai`Generate a greeting`({
      outputFormat: 'json',
      schema,
    })

    expect(result.object).toBeDefined()
    expect(() => schema.parse(result.object)).not.toThrow()
  })

  it('should support streaming responses', async () => {
    const chunks = ['Item 1', 'Item 2', 'Item 3']
    const collected: string[] = []

    const stream: AsyncIterablePromise<string> = ai`List some items`
    for await (const chunk of stream) {
      collected.push(chunk.trim())
    }

    expect(collected).toEqual(chunks)
  })
})
