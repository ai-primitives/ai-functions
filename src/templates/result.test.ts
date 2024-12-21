import { describe, expect, it } from 'vitest'
import { createTemplateResult, parseTemplateInput } from './result'
import type { AIFunctionOptions } from '../types'

describe('Template Result', () => {
  describe('createTemplateResult', () => {
    const mockTemplateFn = async (prompt: string, options: AIFunctionOptions) => 
      `Result: ${prompt} with ${JSON.stringify(options)}`

    it('should create template result with basic functionality', async () => {
      const result = createTemplateResult('test prompt', {}, mockTemplateFn)
      expect(result).toBeDefined()
      expect(typeof result.then).toBe('function')
      expect(typeof result[Symbol.asyncIterator]).toBe('function')
    })

    it('should support async iteration', async () => {
      const result = createTemplateResult('test prompt', {}, mockTemplateFn)
      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }
      expect(chunks.length).toBe(1)
      expect(chunks[0]).toMatch(/^Result: test prompt/)
    })

    it('should support promise-like behavior', async () => {
      const result = createTemplateResult('test prompt', {}, mockTemplateFn)
      const text = await result
      expect(text).toMatch(/^Result: test prompt/)
    })

    it('should support option overrides', async () => {
      const result = createTemplateResult('test prompt', { temperature: 0.5 }, mockTemplateFn)
      const text = await result({ temperature: 0.7 })
      expect(text).toMatch(/"temperature":0.7/)
    })
  })

  describe('parseTemplateInput', () => {
    const defaultOptions: AIFunctionOptions = { temperature: 0.5 }

    it('should handle undefined input', () => {
      const result = parseTemplateInput(undefined, [], defaultOptions)
      expect(result).toEqual({
        prompt: '',
        options: defaultOptions
      })
    })

    it('should parse template strings array', () => {
      const strings = Object.assign(['Hello ', ' world'], { raw: ['Hello ', ' world'] }) as TemplateStringsArray
      const values = ['beautiful']
      const result = parseTemplateInput(strings, values, defaultOptions)
      expect(result).toEqual({
        prompt: 'Hello beautiful world',
        options: defaultOptions
      })
    })

    it('should handle options in last value', () => {
      const strings = Object.assign(['Hello ', ''], { raw: ['Hello ', ''] }) as TemplateStringsArray
      const values = ['world', { temperature: 0.7 }]
      const result = parseTemplateInput(strings, values, defaultOptions)
      expect(result).toEqual({
        prompt: 'Hello world',
        options: { temperature: 0.7 }
      })
    })

    it('should throw on mismatched template slots', () => {
      const strings = Object.assign(['a', 'b', 'c'], { raw: ['a', 'b', 'c'] }) as TemplateStringsArray
      const values = ['x']
      expect(() => parseTemplateInput(strings, values, defaultOptions))
        .toThrow('Template literal slots must match provided values')
    })

    it('should handle direct options object', () => {
      const options = { temperature: 0.7 }
      const result = parseTemplateInput(options, [], defaultOptions)
      expect(result).toEqual({
        prompt: '',
        options: { temperature: 0.7 }
      })
    })
  })
}) 