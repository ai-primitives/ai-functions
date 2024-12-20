import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  generateText,
  generateObject,
  streamText,
  type GenerateTextResult,
  type GenerateObjectResult,
  type StreamTextResult,
  type JSONValue,
  type LanguageModelV1,
  type CoreTool,
} from 'ai'
import { createAIFunction, createTemplateFunction } from '../index'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible'
import type { AIFunctionOptions } from '../../types'

// Mock the AI SDK functions
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

// Mock the AI SDK functions
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

// Mock OpenAI providers
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockImplementation((modelName: string) => ({
    modelId: modelName,
    provider: 'openai',
    specificationVersion: 'v1',
    maxTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
    tools: [],
    toolChoice: 'none'
  })),
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn().mockImplementation(() => {
    return (modelName: string) => ({
      modelId: modelName,
      provider: 'openai-compatible',
      specificationVersion: 'v1',
      maxTokens: 4096,
      temperature: 0.7,
      supportsStreaming: true,
      tools: [],
      toolChoice: 'none'
    })
  }),
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

describe('OpenAI provider integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.AI_GATEWAY
  })

  it('should use custom baseURL when AI_GATEWAY is set', async () => {
    process.env.AI_GATEWAY = 'https://custom-gateway.test'

    const mockProvider = vi.fn().mockImplementation((modelName: string) => ({
      modelId: modelName,
      provider: 'openai-compatible',
    })) as unknown as OpenAICompatibleProvider<string, string, string>

    vi.mocked(createOpenAICompatible).mockReturnValue(mockProvider)

    const fn = createTemplateFunction()
    await fn`test prompt`

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      baseURL: 'https://custom-gateway.test',
      name: 'openai'
    })
    expect(mockProvider).toHaveBeenCalledWith('gpt-4o')
  })

  it('should use default OpenAI when AI_GATEWAY is not set', async () => {
    const mockModel = {
      modelId: 'mock-model',
      provider: 'openai' as const,
      specificationVersion: 'v1' as const,
      maxTokens: 4096,
      temperature: 0.7,
      supportsStreaming: true,
      tools: [] as const,
      toolChoice: 'none' as const
    } as unknown as LanguageModelV1

    vi.mocked(openai).mockReturnValue(mockModel)

    const fn = createTemplateFunction()
    await fn`test prompt`

    expect(createOpenAICompatible).not.toHaveBeenCalled()
    expect(openai).toHaveBeenCalled()
  })

  describe('error handling', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.clearAllMocks()
      process.env.OPENAI_API_KEY = 'test-key'
    })

    it('should throw on missing template strings', () => {
      const fn = createTemplateFunction()
      expect(() => fn()).toThrow('Template strings or options are required')
    })

    it('should throw on invalid options type', () => {
      const fn = createTemplateFunction()
      const invalidOptions = 'not an object' as unknown as AIFunctionOptions
      expect(() => fn(invalidOptions)).toThrow('Options must be an object')
    })

    it('should throw on mismatched template values', () => {
      const fn = createTemplateFunction()
      const templateStrings = Object.assign(['test ', ' ', ' ', ''], {
        raw: ['test ', ' ', ' ', '']
      }) as TemplateStringsArray
      expect(() => fn(templateStrings, 1, 2)).toThrow('Template literal slots must match provided values')
    })

    it('should throw on missing API key', () => {
      delete process.env.OPENAI_API_KEY
      expect(() => createTemplateFunction()).toThrow('OPENAI_API_KEY environment variable is required')
    })
  })

  describe('output format handling', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.clearAllMocks()
      process.env.OPENAI_API_KEY = 'test-key'
    })

    it('should support JSON output format with schema', async () => {
      const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> = {
        text: '{"name": "Test", "value": 123}',
        usage: mockUsage,
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
          messages: [{ role: 'assistant' as const, content: '{"name": "Test", "value": 123}' }] as const,
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

      const fn = createTemplateFunction({
        outputFormat: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' }
          }
        }
      })
      const result = await fn`Generate a test object`
      expect(JSON.parse(result)).toEqual({ name: 'Test', value: 123 })
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('JSON')
        })
      )
    })

    it('should support XML output format', async () => {
      const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> = {
        text: '<root><name>Test</name><value>123</value></root>',
        usage: mockUsage,
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
          messages: [{ role: 'assistant' as const, content: '<root><name>Test</name><value>123</value></root>' }] as const,
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

      const fn = createTemplateFunction({ outputFormat: 'xml' })
      const result = await fn`Generate a test object`
      expect(result).toContain('<root>')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('XML')
        })
      )
    })

    it('should support CSV output format', async () => {
      const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> = {
        text: 'name,value\nTest,123',
        usage: mockUsage,
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
          messages: [{ role: 'assistant' as const, content: 'name,value\nTest,123' }] as const,
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

      const fn = createTemplateFunction({ outputFormat: 'csv' })
      const result = await fn`Generate a test object`
      expect(result).toContain('name,value')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('CSV')
        })
      )
    })

    it('should throw on invalid output format', () => {
      expect(() => createTemplateFunction({ outputFormat: 'invalid' as any }))
        .toThrow('Invalid output format. Supported formats are: json, xml, csv')
    })
  })

  describe('streaming support', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.clearAllMocks()
      process.env.OPENAI_API_KEY = 'test-key'
    })

    it('should support streaming with JSON output format', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield '{"name":'
          yield ' "Test",'
          yield ' "value":'
          yield ' 123}'
        }
      }

      const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, { experimental_stream: AsyncIterable<string> }> = {
        text: '{"name": "Test", "value": 123}',
        usage: mockUsage,
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
          messages: [{ role: 'assistant' as const, content: '{"name": "Test", "value": 123}' }] as const,
        },
        finishReason: 'stop',
        warnings: [],
        request: {},
        logprobs: undefined,
        toolCalls: [],
        toolResults: [],
        steps: [],
        experimental_output: { experimental_stream: mockStream },
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

    it('should support streaming with XML output format', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield '<root>'
          yield '<name>Test</name>'
          yield '<value>123</value>'
          yield '</root>'
        }
      }

      const mockResponse: GenerateTextResult<Record<string, CoreTool<any, any>>, { experimental_stream: AsyncIterable<string> }> = {
        text: '<root><name>Test</name><value>123</value></root>',
        usage: mockUsage,
        response: {
          id: '1',
          timestamp: new Date(),
          modelId: 'test-model',
          messages: [{ role: 'assistant' as const, content: '<root><name>Test</name><value>123</value></root>' }] as const,
        },
        finishReason: 'stop',
        warnings: [],
        request: {},
        logprobs: undefined,
        toolCalls: [],
        toolResults: [],
        steps: [],
        experimental_output: { experimental_stream: mockStream },
        experimental_providerMetadata: {},
      }

      vi.mocked(generateText).mockResolvedValue(mockResponse)

      const fn = createTemplateFunction({ outputFormat: 'xml' })
      const chunks: string[] = []
      for await (const chunk of fn`Generate a test object`) {
        chunks.push(chunk)
      }
      const result = chunks.join('')
      expect(result).toContain('<root>')
      expect(result).toContain('</root>')
    })
