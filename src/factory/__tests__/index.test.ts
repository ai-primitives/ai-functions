import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction } from '../index'
import { createMockTextResponse, createMockObjectResponse } from '../../test-types'

// Import actual Output from ai package instead of mocking
import { Output } from 'ai'

describe('createTemplateFunction', () => {
  describe('output format handling', () => {
    it('should support JSON output format with schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const templateFn = createTemplateFunction({
        outputFormat: 'json',
        schema,
      })

      const result = await templateFn`Generate a person's info`()
      expect(result.object).toBeDefined()
      expect(() => schema.parse(result.object)).not.toThrow()
    })
  })

  describe('streaming support', () => {
    it('should support streaming responses', async () => {
      const templateFn = createTemplateFunction()
      const result = await templateFn`List some items`()

      const chunks = ['Item 1', 'Item 2', 'Item 3']
      const collected: string[] = []

      for await (const chunk of result.experimental_stream!) {
        collected.push(chunk.trim())
      }

      expect(collected).toEqual(chunks)
    })
  })
})
