import { describe, expect, it, beforeEach } from 'vitest'
import { ai, list } from './index'
import { z } from 'zod'
import type { AIFunctionOptions, AsyncIterablePromise } from './types'
import { openai } from '@ai-sdk/openai'

describe('ai template tag', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini', { structuredOutputs: true })

  it('should support basic template literals', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support configuration object', async () => {
    const name = 'World'
    const result = await ai`Hello ${name}`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support JSON output with schema', async () => {
    const schema = z.object({
      greeting: z.string(),
      timestamp: z.number(),
    })

    const result = await ai`Generate a greeting with the current timestamp`({
      model,
      outputFormat: 'json',
      schema
    })
    const parsed = schema.parse(JSON.parse(result))
    expect(parsed).toBeDefined()
    expect(typeof parsed.greeting).toBe('string')
    expect(typeof parsed.timestamp).toBe('number')
  })

  it('should support streaming responses', async () => {
    const streamingModel = openai('gpt-4o', { 
      structuredOutputs: true
    })
    const response = ai`List some items`({ 
      model: streamingModel,
      streaming: {
        onProgress: () => {},
        enableTokenCounting: true
      }
    }) as AsyncIterablePromise<string>
    
    expect(typeof response[Symbol.asyncIterator]).toBe('function')
    const chunks: string[] = []
    for await (const chunk of response) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toMatch(/^[\s\S]+$/)
  })
})

describe('list function', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini', { structuredOutputs: true })

  it('should generate basic lists', async () => {
    const result = await list`fun things to do in Miami`({ model })
    const items = Array.isArray(result) ? result : [result]
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item: string) => typeof item === 'string')).toBe(true)
  })

  it('should support async iteration', async () => {
    const iterator = list`fun things to do in Miami`({ model }) as AsyncIterablePromise<string>
    const collected: string[] = []
    
    for await (const item of iterator) {
      expect(typeof item).toBe('string')
      collected.push(item)
    }
    expect(collected.length).toBeGreaterThan(0)
  })

  it('should accept configuration options', async () => {
    const result = await list`fun things to do in Miami`({ 
      model,
      system: 'You are an expert tour guide',
      temperature: 0.2,
    })
    const items = Array.isArray(result) ? result : [result]
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })
})

describe('structured outputs', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini', { structuredOutputs: true })

  it('should support predefined schemas', async () => {
    const schema = z.object({
      productType: z.enum(['App', 'API', 'Marketplace', 'Platform', 'Packaged Service', 'Professional Service', 'Website']),
      customer: z.string(),
      solution: z.string(),
      description: z.string()
    })

    const result = await ai`Categorize this product: stripe.com`({
      model,
      outputFormat: 'json',
      schema,
      system: 'You are a product analyst. Respond only with valid JSON.',
      temperature: 0
    })
    
    expect(() => JSON.parse(result)).not.toThrow()
    const parsed = JSON.parse(result)
    expect(parsed).toMatchObject({
      productType: expect.stringMatching(/^(App|API|Marketplace|Platform|Packaged Service|Professional Service|Website)$/),
      customer: expect.any(String),
      solution: expect.any(String),
      description: expect.any(String)
    })
    expect(() => schema.parse(parsed)).not.toThrow()
  })

  it('should handle complex data structures', async () => {
    const complexData = {
      dates: ['2024-01-01', '2024-01-02'],
      location: 'Miami Beach',
      activities: ['Swimming', 'Surfing']
    }
    
    const schema = z.object({
      summary: z.string(),
      duration: z.number(),
      highlights: z.array(z.string())
    })
    
    const result = await ai`Summarize the itinerary: ${JSON.stringify(complexData)}`({
      model,
      outputFormat: 'json',
      schema,
      system: 'You are a travel agent. Respond only with valid JSON.',
      temperature: 0
    })
    
    expect(() => JSON.parse(result)).not.toThrow()
    const parsed = JSON.parse(result)
    expect(parsed).toMatchObject({
      summary: expect.any(String),
      duration: expect.any(Number),
      highlights: expect.arrayContaining([expect.any(String)])
    })
    expect(() => schema.parse(parsed)).not.toThrow()
  })

  it('should validate output against custom schemas', async () => {
    const eventSchema = z.object({
      name: z.string(),
      date: z.string(),
      attendees: z.number(),
      location: z.object({
        venue: z.string(),
        city: z.string()
      })
    })

    const result = await ai`Generate an event details summary for a tech conference`({
      model,
      outputFormat: 'json',
      schema: eventSchema,
      system: 'You are an event planner. Respond only with valid JSON.',
      temperature: 0
    })

    expect(() => JSON.parse(result)).not.toThrow()
    const parsed = JSON.parse(result)
    expect(parsed).toMatchObject({
      name: expect.any(String),
      date: expect.any(String),
      attendees: expect.any(Number),
      location: expect.objectContaining({
        venue: expect.any(String),
        city: expect.any(String)
      })
    })
    expect(() => eventSchema.parse(parsed)).not.toThrow()
  })
})
