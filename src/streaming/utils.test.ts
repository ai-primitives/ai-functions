import { describe, expect, it, beforeEach } from 'vitest'
import { generateStreamingList } from './utils'
import type { AIFunctionOptions } from '../types'
import { openai } from '@ai-sdk/openai'

describe('Streaming Utils', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  describe('generateStreamingList', () => {
    const model = openai('gpt-4o-mini')

    it('should generate streaming list with basic options', async () => {
      const options: AIFunctionOptions = {
        model,
        temperature: 0.7,
        maxTokens: 100
      }

      const results: string[] = []
      for await (const item of generateStreamingList('List three colors', options)) {
        results.push(item)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(item => typeof item === 'string')).toBe(true)
    })

    it('should handle streaming progress callback', async () => {
      const progressUpdates: string[] = []
      const options: AIFunctionOptions = {
        model,
        streaming: {
          onProgress: (chunk) => progressUpdates.push(chunk)
        }
      }

      const results: string[] = []
      for await (const item of generateStreamingList('List three animals', options)) {
        results.push(item)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('should handle model parameters', async () => {
      const options: AIFunctionOptions = {
        model,
        temperature: 0.5,
        maxTokens: 50,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        stop: ['END'],
        seed: 42
      }

      const results: string[] = []
      for await (const item of generateStreamingList('List two fruits', options)) {
        results.push(item)
      }

      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', async () => {
      const options: AIFunctionOptions = {
        model: undefined as any // Force fallback to default model
      }

      const results: string[] = []
      for await (const item of generateStreamingList('List items', options)) {
        results.push(item)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(item => typeof item === 'string')).toBe(true)
    })

    it('should handle abort signal', async () => {
      const controller = new AbortController()
      const options: AIFunctionOptions = {
        model,
        signal: controller.signal
      }

      const promise = (async () => {
        const results: string[] = []
        for await (const item of generateStreamingList('List many items', options)) {
          results.push(item)
        }
      })()

      // Abort after a short delay
      setTimeout(() => controller.abort(), 100)

      await expect(promise).rejects.toThrow('Stream was aborted')
    })
  })
}) 