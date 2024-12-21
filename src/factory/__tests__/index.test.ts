import { describe, expect, it, beforeEach } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction, createAIFunction } from '../index'
import type { AIFunctionOptions } from '../../types'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

describe('createAIFunction', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

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

    const result = await fn({ 
      productType: 'App', 
      description: 'A modern web application for task management' 
    }, {
      model: openai('gpt-4o-mini')
    })
    
    expect(result).toHaveProperty('productType')
    expect(result).toHaveProperty('description')
    expect(typeof result.description).toBe('string')
  })
})

describe('createTemplateFunction', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  describe('output format handling', () => {
    it('should support JSON output format with schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const fn = createTemplateFunction({
        outputFormat: 'json',
        schema,
        model: openai('gpt-4o-mini')
      } as AIFunctionOptions)

      const result = await fn`Generate a person's info`
      const parsed = schema.parse(JSON.parse(result))
      expect(parsed).toBeDefined()
      expect(typeof parsed.name).toBe('string')
      expect(typeof parsed.age).toBe('number')
    })
  })

  it('should use custom baseURL when AI_GATEWAY is set', async () => {
    process.env.AI_GATEWAY = 'https://api.openai.com/v1'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

    const fn = createTemplateFunction({
      model: openai('gpt-4o-mini')
    })
    const result = await fn`Write a haiku about coding`
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should use default OpenAI when AI_GATEWAY is not set', async () => {
    delete process.env.AI_GATEWAY
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

    const fn = createTemplateFunction({
      model: openai('gpt-4o-mini')
    })
    const result = await fn`Write a haiku about coding`
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  describe('error handling', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
    })

    it('should handle template strings correctly', async () => {
      const fn = createTemplateFunction({
        model: openai('gpt-4o-mini')
      })
      const result = await fn`List three programming languages`
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should throw on mismatched template values', () => {
      const fn = createTemplateFunction()
      const templateStrings = Object.assign(['test ', ' ', ' ', ''], {
        raw: ['test ', ' ', ' ', ''],
      }) as TemplateStringsArray
      expect(() => fn(templateStrings, 1, 2)).toThrow('Template literal slots must match provided values')
    })
  })

  it('should generate text', async () => {
    const fn = createTemplateFunction()
    const result = await fn`Hello, how are you?`
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support streaming', async () => {
    const fn = createTemplateFunction()
    const chunks: string[] = []
    for await (const chunk of fn`Hello, how are you?`) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should support JSON output with schema', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      outputFormat: 'json',
      schema: {
        name: 'string',
        age: 'number'
      },
      prompt: 'Generate a person with a name and age'
    })
    expect(result).toBeDefined()
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('age')
    expect(typeof parsed.name).toBe('string')
    expect(typeof parsed.age).toBe('number')
  })

  it('should support JSON output without schema', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      outputFormat: 'json',
      prompt: 'Generate a random object'
    })
    expect(result).toBeDefined()
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('should support model parameters', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stop: ['END'],
      seed: 42
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support array of stop sequences', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      stop: ['END', 'STOP']
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support deterministic output with seed', async () => {
    const fn = createTemplateFunction()
    const prompt = 'Generate a random number between 1 and 10'
    const result1 = await fn.withOptions({ seed: 42, prompt })
    const result2 = await fn.withOptions({ seed: 42, prompt })
    expect(result1).toBe(result2)
  })
})
