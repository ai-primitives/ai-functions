import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ai, list } from './index'
import { generateText, streamText, generateObject } from 'ai'
import { z } from 'zod'
import type { GenerateTextResult, GenerateObjectResult, StreamTextResult } from 'ai'

// Define types for our mocks
type Tools = Record<string, never>

interface MockStream {
  [Symbol.asyncIterator](): AsyncGenerator<string, void, unknown>
}

interface MockStreamTextResult {
  textStream: MockStream
  usage: Promise<{
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }>
  warnings: string[]
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other'
  experimental_providerMetadata: Record<string, unknown>
  text: string
  tools: Record<string, never>
  toolChoice: 'auto' | 'none' | 'required'
  temperature: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  stop?: string[]
  maxTokens?: number
  seed?: number
  _internal?: Record<string, unknown>
  toolCalls: never[]
  toolResults: never[]
  steps: never[]
  request: { prompt: string }
  model: { id: string; provider: string }
}

// Mock the ai package
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  generateObject: vi.fn(),
}))

describe('ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should support template literal usage', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Generated text',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as GenerateTextResult<Tools, string>)

    const result = await ai`Hello ${123}`
    expect(result).toBe('Generated text')
  })

  it('should support categorizeProduct function', async () => {
    const mockResult = {
      productType: 'App',
      customer: 'Small Business Owners',
      solution: 'Automated accounting software',
      description: 'AI-powered accounting automation for small businesses',
    }

    vi.mocked(generateObject).mockResolvedValue({
      object: mockResult,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as GenerateObjectResult<typeof mockResult>)

    const result = await ai.categorizeProduct({
      productType: 'App',
      customer: 'Small Business Owners',
      solution: 'Automated accounting software',
      description: 'AI-powered accounting automation for small businesses',
    })
    expect(result).toEqual(mockResult)
  })

  it('should return schema when categorizeProduct called without args', async () => {
    const result = await ai.categorizeProduct()
    expect(result).toHaveProperty('schema')
    expect(result.schema).toBeInstanceOf(z.ZodSchema)
  })

  it('should support streaming with async iteration', async () => {
    const chunks = ['Hello', ' ', 'World']
    const mockStream: MockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }

    const mockResult: MockStreamTextResult = {
      textStream: mockStream,
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }),
      warnings: [],
      finishReason: 'stop',
      experimental_providerMetadata: {},
      text: chunks.join(''),
      tools: {},
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 100,
      toolCalls: [],
      toolResults: [],
      steps: [],
      request: { prompt: 'Hello World' },
      model: { id: 'gpt-4o', provider: '@ai-sdk/openai' },
    }

    vi.mocked(streamText).mockReturnValue(mockResult as unknown as StreamTextResult<Tools>)

    const collected: string[] = []
    for await (const chunk of ai`Hello World`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})

describe('list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should support template literal usage', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'Item 1\nItem 2\nItem 3',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as GenerateTextResult<Tools, string>)

    const result = await list`fun things to do in Miami`
    expect(result).toBe('Item 1\nItem 2\nItem 3')
  })

  it('should support async iteration', async () => {
    const chunks = ['Item 1', '\n', 'Item 2', '\n', 'Item 3']
    const mockStream: MockStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }

    const mockResult: MockStreamTextResult = {
      textStream: mockStream,
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 20, totalTokens: 30 }),
      warnings: [],
      finishReason: 'stop',
      experimental_providerMetadata: {},
      text: chunks.join(''),
      tools: {},
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 100,
      toolCalls: [],
      toolResults: [],
      steps: [],
      request: { prompt: 'fun things to do in Miami' },
      model: { id: 'gpt-4o', provider: '@ai-sdk/openai' },
    }

    vi.mocked(streamText).mockReturnValue(mockResult as unknown as StreamTextResult<Tools>)

    const collected: string[] = []
    for await (const chunk of list`fun things to do in Miami`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
