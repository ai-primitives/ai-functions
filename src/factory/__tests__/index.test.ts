import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction } from '../index'
import type { AIFunctionOptions } from '../../types'

describe('createTemplateFunction', () => {
  describe('output format handling', () => {
    it('should support JSON output format with schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const fn = createTemplateFunction({
        outputFormat: 'json',
        schema,
      } as AIFunctionOptions)

      const result = await fn`Generate a person's info`
      const parsed = schema.parse(result)
      expect(parsed).toBeDefined()
      expect(typeof parsed.name).toBe('string')
      expect(typeof parsed.age).toBe('number')
    })
  })

  describe('streaming support', () => {
    it('should support streaming responses', async () => {
      const fn = createTemplateFunction()
      const stream = fn`List some items`

      const chunks = ['Item 1', 'Item 2', 'Item 3']
      const collected: string[] = []

      for await (const chunk of stream) {
        collected.push(chunk.trim())
      }

      expect(collected).toEqual(chunks)
    })
  })
})
