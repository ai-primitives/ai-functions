import { z } from 'zod'
import { streamObject, streamText, type StreamTextResult } from 'ai'
import type { AIFunctionOptions } from '../types'
import { getProvider } from '../providers/config'

export async function* generateStreamingList(
  prompt: string,
  options: AIFunctionOptions
): AsyncGenerator<string> {
  const modelParams = {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
    stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
    seed: options.seed
  }

  try {
    const model = options.model || getProvider()('gpt-4o-mini')
    const result = streamObject({
      model,
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
      system: options.system,
      ...modelParams,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          options.streaming?.onProgress?.(chunk.text)
        }
      }
    })

    yield* result.elementStream
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Stream was aborted')
      } else if (error.name === 'TimeoutError') {
        throw new Error('Stream timed out')
      } else {
        throw error
      }
    }
    throw new Error('Failed to generate list: Unknown error occurred')
  }
}

export async function* generateStreamingText(
  prompt: string,
  options: AIFunctionOptions
): AsyncGenerator<string> {
  try {
    const model = options.model || getProvider()('gpt-4o-mini')
    const result = streamText({
      model,
      prompt,
      system: options.system,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          options.streaming?.onProgress?.(chunk.text)
        }
      }
    })

    yield* result.textStream
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Stream was aborted')
      } else if (error.name === 'TimeoutError') {
        throw new Error('Stream timed out')
      } else {
        throw error
      }
    }
    throw new Error('Failed to generate text: Unknown error occurred')
  }
} 