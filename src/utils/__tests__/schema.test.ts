import { describe, it, expect } from 'vitest'
import { createSchemaFromTemplate } from '../schema'
import { z } from 'zod'

describe('createSchemaFromTemplate', () => {
  it('should create enum schema for pipe-separated values', () => {
    const template = {
      productType: 'App | API | Marketplace'
    }
    const schema = createSchemaFromTemplate(template)
    const result = schema.safeParse({ productType: 'App' })
    expect(result.success).toBe(true)

    const productTypeField = schema._def.shape().productType as z.ZodEnum<[string, ...string[]]>
    expect(productTypeField._def.description).toBe('App | API | Marketplace')
    expect(productTypeField.options).toContain('App')
    expect(productTypeField.options).toContain('API')
    expect(productTypeField.options).toContain('Marketplace')
  })

  it('should create string schema with description', () => {
    const template = {
      description: 'website meta description'
    }
    const schema = createSchemaFromTemplate(template)
    const result = schema.safeParse({ description: 'A great website' })
    expect(result.success).toBe(true)

    const descriptionField = schema._def.shape().description as z.ZodString
    expect(descriptionField._def.description).toBe('website meta description')
  })

  it('should enforce word count constraints', () => {
    const template = {
      customer: 'ideal customer profile in 3-5 words'
    }
    const schema = createSchemaFromTemplate(template)

    // Valid case
    const validResult = schema.safeParse({ customer: 'small business tech startups' })
    expect(validResult.success).toBe(true)

    // Too few words
    const tooFewResult = schema.safeParse({ customer: 'small businesses' })
    expect(tooFewResult.success).toBe(false)
    if (!tooFewResult.success) {
      expect(tooFewResult.error.errors[0].message).toBe('Must be between 3 and 5 words')
    }

    // Too many words
    const tooManyResult = schema.safeParse({ customer: 'small business tech startups in California' })
    expect(tooManyResult.success).toBe(false)
    if (!tooManyResult.success) {
      expect(tooManyResult.error.errors[0].message).toBe('Must be between 3 and 5 words')
    }
  })
})
