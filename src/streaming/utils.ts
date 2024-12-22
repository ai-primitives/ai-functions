import { streamObject } from 'ai'
import { z } from 'zod'
import type { AIFunctionOptions } from '../types'

export async function* streamElements(options: AIFunctionOptions): AsyncGenerator<string> {
  const modelParams = {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
    stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
    seed: options.seed
  }

  if (!options.model) {
    throw new Error('Model is required for streaming')
  }

  try {
    const model = options.model
    const streamOptions = {
      model,
      output: 'no-schema' as const,
      schema: z.string(),
      prompt: `Generate a list of items based on this prompt: ${options.prompt}`,
      system: options.system,
      ...modelParams,
      signal: options.signal,
      onChunk: options.streaming?.onProgress ? ({ chunk }: { chunk: { type: string; textDelta?: string } }) => {
        if (chunk.type === 'text-delta' && chunk.textDelta && options.streaming?.onProgress) {
          options.streaming.onProgress(chunk.textDelta)
        }
      } : undefined
    }

    const result = await streamObject(streamOptions)
    const items = (result as { text: string }).text.split('\n').filter(Boolean)
    for (const item of items) {
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
      } else if (error.name === 'TimeoutError') {
        throw new Error('Stream timed out')
      }
      throw error
    }
    throw new Error('Failed to generate list: Unknown error occurred')
  }
} 