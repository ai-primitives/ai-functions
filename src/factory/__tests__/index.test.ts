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
})
