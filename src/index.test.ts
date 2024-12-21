import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateText, type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool } from 'ai'
import { Response, Headers } from 'undici'
import { ai, list } from './index'

// Mock the AI SDK functions
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockImplementation((config) => config),
    text: vi.fn().mockImplementation((config) => config),
  },
}))

// Mock usage data
const mockUsage = {
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
}

describe('ai', () => {
  it('should support template literal usage', async () => {
    const mockResponse: GenerateTextResult<Record<string, CoreTool<string, unknown>>, Record<string, unknown>> = {
      text: 'Generated text',
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: 'Generated text' }] as const,
      },
      finishReason: 'stop',
      warnings: [],
      request: {},
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      steps: [],
      experimental_output: {} as Record<string, unknown>,
      experimental_providerMetadata: {},
    }
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const result = await ai`Hello ${123}`
    expect(result).toBe('Generated text')
  })

  it('should support categorizeProduct function', async () => {
    const mockResult = {
      productType: 'App',
      description: 'A cool app',
    }

    const mockResponse: GenerateObjectResult<JSONValue> = {
      object: mockResult,
      usage: mockUsage,
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
      toJsonResponse: () =>
        new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }),
    }
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const result = await ai.categorizeProduct({ productType: 'App', description: 'test' })
    expect(result).toEqual(mockResult)
  })

  it('should return schema when categorizeProduct called without args', async () => {
    const result = await ai.categorizeProduct()
    expect(result).toHaveProperty('schema')
    expect(result.schema).toBeInstanceOf(z.ZodObject)
  })

  it('should support streaming with async iteration', async () => {
    const chunks = ['Hello', ' ', 'World']
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }

    const mockResponse: GenerateTextResult<Record<string, CoreTool<string, unknown>>, { experimental_stream: AsyncIterable<string> }> = {
      text: chunks.join(''),
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: chunks.join('') }] as const,
      },
      finishReason: 'stop',
      warnings: [],
      request: {},
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      steps: [],
      experimental_output: { experimental_stream: mockStream },
      experimental_stream: mockStream,
      experimental_providerMetadata: {},
    }

    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const collected: string[] = []
    for await (const chunk of ai`Stream this`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})

describe('list', () => {
  it('should support template literal usage', async () => {
    const mockResponse: GenerateTextResult<Record<string, CoreTool<string, unknown>>, Record<string, unknown>> = {
      text: 'Item 1\nItem 2\nItem 3',
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: 'Item 1\nItem 2\nItem 3' }] as const,
      },
      finishReason: 'stop',
      warnings: [],
      request: {},
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      steps: [],
      experimental_output: {} as Record<string, unknown>,
      experimental_providerMetadata: {},
    }
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const result = await list`Generate a list`
    expect(result).toBe('Item 1\nItem 2\nItem 3')
  })

  it('should support async iteration', async () => {
    const text = 'Item 1\nItem 2\nItem 3'
    const chunks = text.split('\n')
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }

    const mockResponse: GenerateTextResult<Record<string, CoreTool<string, unknown>>, { experimental_stream: AsyncIterable<string> }> = {
      text,
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: text }] as const,
      },
      finishReason: 'stop',
      warnings: [],
      request: {},
      logprobs: undefined,
      toolCalls: [],
      toolResults: [],
      steps: [],
      experimental_output: { experimental_stream: mockStream },
      experimental_stream: mockStream,
      experimental_providerMetadata: {},
    }

    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const collected: string[] = []
    for await (const chunk of list`Generate a list`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
