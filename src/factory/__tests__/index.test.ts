import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateText } from 'ai'
import { createTemplateFunction } from '../index'
import { createMockTextResponse, createMockObjectResponse, createMockStreamResponse } from '../../test-types'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

describe('createTemplateFunction', () => {
  it('should support basic template literal usage', async () => {
    const mockResponse = createMockTextResponse('Generated text')
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const fn = createTemplateFunction()
    const result = await fn`Generate text`
    expect(result).toBe('Generated text')
  })

  it('should support options', async () => {
    const fn = createTemplateFunction()
    const options = { prompt: 'Custom prompt' }
    await fn.withOptions(options)
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining(options))
  })

  describe('output format handling', () => {
    it('should support JSON output format with schema', async () => {
      const mockResult = { name: 'Test', value: 123 }
      const mockResponse = createMockObjectResponse(mockResult)
      vi.mocked(generateText).mockResolvedValue(mockResponse)

      const schema = z.object({
        name: z.string(),
        value: z.number(),
      })
      const fn = createTemplateFunction({
        outputFormat: 'json',
        schema,
      })
      const result = await fn`Generate a test object`
      expect(JSON.parse(result)).toEqual(mockResult)
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_output: expect.any(Object),
        }),
      )
    })

    it('should throw on invalid output format', () => {
      expect(() => createTemplateFunction({ outputFormat: 'invalid' as any })).toThrow(
        'Invalid output format. Only JSON is supported',
      )
    })
  })

  describe('streaming support', () => {
    it('should support streaming with JSON output format', async () => {
      const mockResult = { name: 'Test', value: 123 }
      const mockResponse = createMockStreamResponse([JSON.stringify(mockResult)])
      vi.mocked(generateText).mockResolvedValue(mockResponse)

      const fn = createTemplateFunction({ outputFormat: 'json' })
      const chunks: string[] = []
      for await (const chunk of fn`Generate a test object`) {
        chunks.push(chunk)
      }
      expect(JSON.parse(chunks.join(''))).toEqual(mockResult)
    })
  })
})
