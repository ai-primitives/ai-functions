import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateText } from 'ai'
import { createTemplateFunction } from '../index'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockImplementation((config) => config),
    text: vi.fn().mockImplementation((config) => config),
  },
}))

describe('createTemplateFunction', () => {
  it('should support basic template literal usage', async () => {
    const mockResponse = {
      text: 'Generated text',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant', content: 'Generated text' }],
      },
      finishReason: 'stop',
      warnings: [],
      request: {},
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      steps: [],
      experimental_output: {},
      experimental_providerMetadata: {},
    }
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
      const mockResponse = {
        text: JSON.stringify(mockResult),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
        },
        finishReason: 'stop',
        warnings: [],
        request: {},
        logprobs: undefined,
        experimental_output: mockResult,
        experimental_providerMetadata: {},
      }
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
      expect(JSON.parse(result)).toEqual({ name: 'Test', value: 123 })
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_output: expect.any(Object),
        }),
      )
    })

    it('should throw on invalid output format', () => {
      expect(() => createTemplateFunction({ outputFormat: 'invalid' as z.infer<typeof z.string> })).toThrow('Invalid output format. Only JSON is supported')
    })
  })

  describe('streaming support', () => {
    it('should support streaming with JSON output format', async () => {
      const mockResult = { name: 'Test', value: 123 }
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify(mockResult)
        },
      }
      const mockResponse = {
        text: JSON.stringify(mockResult),
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
        },
        finishReason: 'stop',
        warnings: [],
        request: {},
        logprobs: undefined,
        experimental_output: mockResult,
        experimental_stream: mockStream,
        experimental_providerMetadata: {},
      }
      vi.mocked(generateText).mockResolvedValue(mockResponse)

      const fn = createTemplateFunction({ outputFormat: 'json' })
      const chunks: string[] = []
      for await (const chunk of fn`Generate a test object`) {
        chunks.push(chunk)
      }
      expect(JSON.parse(chunks.join(''))).toEqual({ name: 'Test', value: 123 })
    })
  })
})
