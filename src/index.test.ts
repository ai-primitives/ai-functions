import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateText } from 'ai'
import { ai, list } from './index'
import { createMockTextResponse, createMockObjectResponse, createMockStreamResponse } from './test-types'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

describe('ai', () => {
  it('should support template literal usage', async () => {
    const mockResponse = createMockTextResponse('Generated text')
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const result = await ai`Hello ${123}`
    expect(result).toBe('Generated text')
  })

  it('should support categorizeProduct function', async () => {
    const mockResult = {
      productType: 'App',
      description: 'A cool app',
    }
    const mockResponse = createMockObjectResponse(mockResult)
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
    const mockResponse = createMockStreamResponse(chunks)
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
    const mockResponse = createMockTextResponse('Item 1\nItem 2\nItem 3')
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const result = await list`Generate a list`
    expect(result).toBe('Item 1\nItem 2\nItem 3')
  })

  it('should support async iteration', async () => {
    const chunks = ['Item 1\n', 'Item 2\n', 'Item 3']
    const mockResponse = createMockStreamResponse(chunks)
    vi.mocked(generateText).mockResolvedValue(mockResponse)

    const collected: string[] = []
    for await (const chunk of list`Generate a list`) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
