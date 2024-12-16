import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import {
  generateText,
  streamText,
  generateObject,
  type GenerateTextResult,
  type GenerateObjectResult,
  type StreamTextResult,
  type LanguageModelV1,
  type CoreTool,
  type JSONValue,
} from 'ai'
import { createAIFunction, createTemplateFunction } from '../index'

// Mock the AI SDK functions
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

// Mock usage data
const mockUsage = {
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
}

describe('createAIFunction', () => {
  it('should return schema when called without args', async () => {
    const schema = z.object({
      productType: z.enum(['App', 'API', 'Marketplace']),
      description: z.string().describe('website meta description'),
    })
    const fn = createAIFunction(schema)

    const result = await fn()
    expect(result).toHaveProperty('schema')
    expect(result.schema).toBeInstanceOf(z.ZodObject)
  })

  it('should generate content when called with args', async () => {
    const schema = z.object({
      productType: z.enum(['App', 'API', 'Marketplace']),
      description: z.string().describe('website meta description'),
    })
    const fn = createAIFunction(schema)

    type SchemaType = z.infer<typeof schema>
    const mockResult: SchemaType = {
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
      experimental_providerMetadata: {},
      toJsonResponse: () =>
        new globalThis.Response(JSON.stringify(mockResult), {
          status: 200,
          headers: new globalThis.Headers({ 'Content-Type': 'application/json' }),
        }),
    }
    vi.mocked(generateObject).mockResolvedValue(mockResponse)

    const result = await fn({ productType: 'App', description: 'test' })
    expect(result).toEqual(mockResult)
  })
})

describe('createTemplateFunction', () => {
  it('should support basic template literal usage', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> = {
      text: 'Hello World',
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: 'Hello World' }] as const,
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

    const fn = createTemplateFunction()
    const result = await fn`Hello ${123}`

    expect(result).toBe('Hello World')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Hello 123',
      }),
    )
  })

  it('should support options', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> = {
      text: 'Custom Model Result',
      usage: mockUsage,
      response: {
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: 'Custom Model Result' }] as const,
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

    const fn = createTemplateFunction()
    const result = await fn({ prompt: 'Test', model: {} as LanguageModelV1 })

    expect(result).toBe('Custom Model Result')
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test',
      }),
    )
  })

  it('should support streaming with async iterator', async () => {
    const chunks = ['Hello', ' ', 'World']
    const mockStream = new globalThis.ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk))
        controller.close()
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockResponse: StreamTextResult<Record<string, CoreTool<any, any>>> = {
      textStream: mockStream,
      usage: Promise.resolve(mockUsage),
      response: Promise.resolve({
        id: '1',
        timestamp: new Date(),
        modelId: 'test-model',
        messages: [{ role: 'assistant' as const, content: 'Hello World' }] as const,
      }),
      text: Promise.resolve(''),
      warnings: Promise.resolve([]),
      finishReason: Promise.resolve('stop'),
      experimental_providerMetadata: Promise.resolve({}),
      request: Promise.resolve({}),
      toolCalls: Promise.resolve([]),
      toolResults: Promise.resolve([]),
      steps: Promise.resolve([]),
      fullStream: mockStream,
      toDataStream: () => mockStream,
      mergeIntoDataStream: () => mockStream,
      pipeDataStreamToResponse: async () => new globalThis.Response(mockStream),
      pipeTextStreamToResponse: async () => new globalThis.Response(mockStream),
      toDataStreamResponse: () => new globalThis.Response(mockStream),
      toTextStreamResponse: () => new globalThis.Response(mockStream),
    }
    vi.mocked(streamText).mockReturnValue(mockResponse)

    const fn = createTemplateFunction()
    const collected: string[] = []

    for await (const chunk of fn) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
