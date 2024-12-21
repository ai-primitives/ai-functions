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
    seed: options.seed,
    signal: options.signal
  }

  const model = options.model || getProvider()('gpt-4o-mini')

  try {
    if (options.signal?.aborted) {
      throw new Error('Stream was aborted')
    }

    const { elementStream } = streamObject({
      model,
      output: 'array',
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${prompt}`,
      system: options.system,
      ...modelParams,
      signal: options.signal,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta' && options.streaming?.onProgress) {
          options.streaming.onProgress(chunk.text)
        }
      }
    })

    try {
      for await (const item of elementStream) {
        if (options.signal?.aborted) {
          throw new Error('Stream was aborted')
        }
        if (options.streaming?.onProgress) {
          options.streaming.onProgress(item)
        }
        yield item
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR' || options.signal?.aborted) {
          throw new Error('Stream was aborted')
        }
        throw error
      }
      throw error
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR' || options.signal?.aborted) {
        throw new Error('Stream was aborted')
      } else if (error.name === 'TimeoutError') {
        throw new Error('Stream timed out')
      }
      throw error
    }
    throw new Error('Failed to generate list: Unknown error occurred')
  }
}

export async function* generateStreamingText(
  prompt: string,
  options: AIFunctionOptions
): AsyncGenerator<string> {
  const model = options.model || getProvider()('gpt-4o-mini')

  try {
    if (options.signal?.aborted) {
      throw new Error('Stream was aborted')
    }

    const { textStream } = streamText({
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
      signal: options.signal,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta' && options.streaming?.onProgress) {
          options.streaming.onProgress(chunk.text)
        }
      }
    })

    try {
      for await (const text of textStream) {
        if (options.signal?.aborted) {
          throw new Error('Stream was aborted')
        }
        if (options.streaming?.onProgress) {
          options.streaming.onProgress(text)
        }
        yield text
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR' || options.signal?.aborted) {
          throw new Error('Stream was aborted')
        }
        throw error
      }
      throw error
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR' || options.signal?.aborted) {
        throw new Error('Stream was aborted')
      } else if (error.name === 'TimeoutError') {
        throw new Error('Stream timed out')
      }
      throw error
    }
    throw new Error('Failed to generate text: Unknown error occurred')
  }
} 