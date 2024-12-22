import { describe, expect, it } from 'vitest'
import { streamElements } from './utils'
import { openai } from '@ai-sdk/openai'

describe('Streaming Utils', () => {
  it('should stream elements', async () => {
    const model = openai('gpt-4o-mini')
    const chunks: string[] = []

    for await (const item of streamElements({
      model,
      prompt: 'List 3 colors',
      streaming: {
        onProgress: (chunk) => chunks.push(chunk)
      }
    })) {
      expect(typeof item).toBe('string')
    }

    expect(chunks.length).toBeGreaterThan(0)
  })
}) 