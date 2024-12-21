import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction } from '../index'
import type { AsyncIterablePromise } from '../../types'

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
      })

      // Use template literal syntax properly
      const result = await fn`Generate a person's info`
      expect(result.object).toBeDefined()
      expect(() => schema.parse(result.object)).not.toThrow()
    })
  })

  describe('streaming support', () => {
    it('should support streaming responses', async () => {
      const fn = createTemplateFunction()
      const result = await fn`List some items`

      const chunks = ['Item 1', 'Item 2', 'Item 3']
      const collected: string[] = []

      // Handle AsyncIterablePromise correctly
      for await (const chunk of result) {
        collected.push(chunk.trim())
      }

      expect(collected).toEqual(chunks)
    })
  })
})
