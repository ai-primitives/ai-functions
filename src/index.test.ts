import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ai, list } from './index'
import { generateText, streamText, generateObject } from 'ai'
import { z } from 'zod'
import type { GenerateTextResult, GenerateObjectResult, StreamTextResult } from 'ai'

// Define types for our mocks
type Tools = Record<string, never>
type MockStream = {
  [Symbol.asyncIterator](): AsyncGenerator<string, void, unknown>
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
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
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
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    } as GenerateObjectResult<typeof mockResult>)

    const result = await ai.categorizeProduct({
      domain: 'quickbooks.com'
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
      }
    }

    vi.mocked(streamText).mockReturnValue({
      textStream: mockStream,
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
    } as StreamTextResult<Tools>)

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
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
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
      }
    }

    vi.mocked(streamText).mockReturnValue({
      textStream: mockStream,
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
    } as StreamTextResult<Tools>)

    const collected: string[] = []
    for await (const chunk of list`fun things to do in Miami`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
