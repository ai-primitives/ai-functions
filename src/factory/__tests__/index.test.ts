import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction } from '../index'
import type { AIFunctionOptions } from '../../types'

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
    toolChoice: 'none',
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
      toolChoice: 'none',
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
      name: 'openai',
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
      toolChoice: 'none' as const,
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
      const stream = fn`List some items`

      const chunks = ['Item 1', 'Item 2', 'Item 3']
      const collected: string[] = []

    it('should throw on mismatched template values', () => {
      const fn = createTemplateFunction()
      const templateStrings = Object.assign(['test ', ' ', ' ', ''], {
        raw: ['test ', ' ', ' ', ''],
      }) as TemplateStringsArray
      expect(() => fn(templateStrings, 1, 2)).toThrow('Template literal slots must match provided values')
    })

      expect(collected).toEqual(chunks)
    })
  })
})
