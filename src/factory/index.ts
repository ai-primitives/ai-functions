import { generateText, generateObject, Output, type GenerateTextResult, type JSONValue, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { Response, type BodyInit } from 'undici'
import { z } from 'zod'
import PQueue from 'p-queue'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue } from '../types'
import { createRequestHandler } from '../utils/request-handler';
import { StreamProgressTracker } from '../utils/stream-progress';
import { AIRequestError } from '../errors'
import { TemplateResult } from '../types';

// Add this at the top of the file, before any other code
function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

// PLACEHOLDER: imports and type definitions

// Use global ReadableStream type from lib.dom.d.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
export type GenerateResult = GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>
/* eslint-enable @typescript-eslint/no-explicit-any */

export type GenerateJsonResult = GenerateResult & {
  object: JSONValue
  toJsonResponse: () => Response
}

export type StreamingResult = GenerateResult & {
  experimental_stream: AsyncIterable<string>
}

export function isStreamingResult(result: unknown): result is StreamingResult {
  return (
    result !== null &&
    typeof result === 'object' &&
    'experimental_stream' in result &&
    typeof (result as StreamingResult).experimental_stream === 'object' &&
    Symbol.asyncIterator in (result as StreamingResult).experimental_stream
  )
}

export function isJsonResult(result: GenerateResult): result is GenerateJsonResult {
  return 'object' in result && 'toJsonResponse' in result
}

// PLACEHOLDER: response creation functions

// Helper function to create an async iterable promise
export function createAsyncIterablePromise(asyncIterable: AsyncIterable<string>, promise: Promise<string>): AsyncIterablePromise<string> {
  return Object.assign(
    async () => promise,
    {
      then: (onfulfilled?: ((value: string) => string | PromiseLike<string>) | null | undefined, onrejected?: ((reason: unknown) => string | PromiseLike<string>) | null | undefined): Promise<string> => promise.then(onfulfilled, onrejected),
      catch: (onrejected?: ((reason: unknown) => string | PromiseLike<string>) | null | undefined): Promise<string> => promise.catch(onrejected),
      finally: (onfinally?: (() => void) | null | undefined): Promise<string> => promise.finally(onfinally),
      [Symbol.asyncIterator]: () => asyncIterable[Symbol.asyncIterator]()
    }
  ) as AsyncIterablePromise<string>
}

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = (args?: z.infer<T>, options: AIFunctionOptions = {}): { schema: T } | Promise<z.infer<T>> | AsyncIterablePromise<string> => {
    if (!args) {
      return { schema } as { schema: T }
    }

    const requestHandler = createRequestHandler({ requestHandling: options.requestHandling });
    const progressTracker = options.streaming ? 
      new StreamProgressTracker(options.streaming) : undefined;

    const executeRequest = async () => {
      const result = await generateText({
        model: options.model || getProvider()('gpt-4o') as LanguageModelV1,
        prompt: options.prompt || '',
        maxRetries: 2,
        experimental_output: options.streaming ? undefined : Output.object({ schema: schema }),
        system: options.system,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
        seed: options.seed
      });

      if (!result) {
        throw new Error('No result received from model')
      }

      if (!result.experimental_output) {
        // If no experimental output, try to parse the text as JSON
        try {
          const parsed = JSON.parse(result.text);
          return { ...result, experimental_output: parsed };
        } catch {
          throw new Error('No valid output received from model')
        }
      }

      return result;
    };

    if (options.streaming) {
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          const result = await requestHandler.execute(executeRequest);
          if (isStreamingResult(result)) {
            let fullText = '';
            let isJson = options?.outputFormat === 'json';
            
            for await (const chunk of result.experimental_stream) {
              if (progressTracker) {
                progressTracker.onChunk(chunk);
              }
              fullText += chunk;
              // For JSON streaming, only yield complete objects
              if (!isJson) {
                yield chunk;
              }
            }
            if (progressTracker) {
              progressTracker.onComplete();
            }
            
            // Handle JSON parsing if needed
            if (isJson) {
              try {
                const parsed = JSON.parse(fullText);
                if (options?.schema) {
                  // Validate against schema if provided
                  const zodSchema = options.schema instanceof z.ZodType 
                    ? options.schema 
                    : z.object(options.schema as Record<string, z.ZodType>);
                  return zodSchema.parse(parsed);
                }
                return parsed;
              } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                throw new Error(`Failed to parse JSON response: ${errorMessage}`);
              }
            }
            return fullText;
          } else {
            const output = result.experimental_output;
            if (typeof output === 'string') {
              try {
                const parsed = JSON.parse(output);
                if (progressTracker) {
                  progressTracker.onChunk(JSON.stringify(parsed));
                  progressTracker.onComplete();
                }
                yield JSON.stringify(parsed);
              } catch {
                if (progressTracker) {
                  progressTracker.onChunk(output);
                  progressTracker.onComplete();
                }
                yield output;
              }
            } else {
              const text = JSON.stringify(output);
              if (progressTracker) {
                progressTracker.onChunk(text);
                progressTracker.onComplete();
              }
              yield text;
            }
          }
        }
      };

      const promise = (async () => {
        const result = await requestHandler.execute(executeRequest);
        const output = result.experimental_output;
        return typeof output === 'string' ? output : JSON.stringify(output);
      })();
      return createAsyncIterablePromise(asyncIterable, promise);
    }

    return (async () => {
      const result = await requestHandler.execute(executeRequest);
      const output = result.experimental_output;
      // Parse the output if it's a string, otherwise return as is
      if (typeof output === 'string') {
        try {
          return JSON.parse(output);
        } catch {
          return output;
        }
      }
      return output;
    })();
  }

  fn.schema = schema
  return fn as AIFunction<T>
}

// PLACEHOLDER: createTemplateFunction implementation

export function getProvider() {
  const gateway = process.env.AI_GATEWAY
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  return gateway
    ? createOpenAICompatible({
        baseURL: gateway,
        name: 'openai',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      } satisfies OpenAICompatibleProviderSettings)
    : openai
}

export function createJsonResponse(result: GenerateJsonResult): Response {
  return result.toJsonResponse()
}

export function createStreamResponse(result: StreamingResult): Response {
  return new Response(result.experimental_stream as unknown as BodyInit, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

export function createTextResponse(result: GenerateResult): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

export function createTemplateFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  let currentPrompt: string | undefined
  let queue: Queue | undefined

  const initQueue = (options: AIFunctionOptions) => {
    const concurrency = options.concurrency || options.requestHandling?.concurrency || defaultOptions.concurrency || 1;
    const delay = options.requestHandling?.delay || defaultOptions.requestHandling?.delay || 0;
    
    if (!queue || queue.concurrency !== concurrency || (queue as any).options?.interval !== delay) {
      queue = new PQueue({ 
        concurrency,
        interval: delay,
        intervalCap: concurrency
      });
    }
    return queue;
  }

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions): Promise<string> => {
    currentPrompt = prompt
    
    const modelParams = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed,
      system: options.system,
    }

    const executeRequest = async (): Promise<string> => {
      try {
        if (options.outputFormat === 'json') {
          try {
            const model = options.model || openai(process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o', { structuredOutputs: true })
            if (options.schema) {
              const schema = options.schema instanceof z.ZodType 
                ? options.schema 
                : z.object(Object.fromEntries(
                    Object.entries(options.schema as Record<string, string>).map(([key, type]) => [
                      key,
                      type === 'string' ? z.string() :
                      type === 'number' ? z.number() :
                      type === 'boolean' ? z.boolean() :
                      type === 'array' ? z.array(z.unknown()) :
                      type === 'object' ? z.record(z.string(), z.unknown()) :
                      z.unknown()
                    ])
                  ))
              const result = await generateObject({
                model,
                schema,
                prompt,
                ...modelParams,
              })
              return JSON.stringify(result.object)
            } else {
              const result = await generateObject({
                model,
                output: 'no-schema',
                prompt,
                ...modelParams,
              })
              return JSON.stringify(result.object)
            }
          } catch (error) {
            if (error instanceof Error) {
              throw new AIRequestError(`Invalid JSON format: ${error.message}`, error, false)
            }
            throw new AIRequestError('Invalid JSON format', error, false)
          }
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const result = (await generateText({
          model: options.model || getProvider()('gpt-4o'),
          prompt,
          ...modelParams,
          ...options,
        })) as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>
        /* eslint-enable @typescript-eslint/no-explicit-any */

        if (!result) {
          throw new AIRequestError('No result received from model', undefined, false)
        }

        return result.text
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new AIRequestError('Failed to generate text', error, false)
      }
    }

    try {
      const currentQueue = initQueue(options)
      if (!currentQueue) {
        return executeRequest()
      }
      return currentQueue.add(executeRequest)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new AIRequestError('Failed to generate text', error, false)
    }
  }

  const asyncIterator = async function* (): AsyncIterator<string> {
    if (!currentPrompt) {
      return
    }

    const options = {
      ...defaultOptions,
      concurrency: defaultOptions.concurrency || defaultOptions.requestHandling?.concurrency || 1
    }
    const modelParams = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
      seed: options.seed,
      system: options.system,
    }

    const progressTracker = options.streaming ? 
      new StreamProgressTracker(options.streaming) : undefined;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const executeRequest = async (): Promise<GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>> => {
      const result = (await generateText({
        model: options.model || getProvider()('gpt-4o'),
        prompt: currentPrompt,
    /* eslint-enable @typescript-eslint/no-explicit-any */
        maxRetries: 2,
        ...modelParams,
        ...options,
      })) /* eslint-disable @typescript-eslint/no-explicit-any */ as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>> /* eslint-enable @typescript-eslint/no-explicit-any */

      if (!result) {
        throw new Error('No result received from model')
      }

      return result
    }

    try {
      const currentQueue = initQueue(options)
      const result = await currentQueue.add(executeRequest)

      if (isStreamingResult(result)) {
        for await (const chunk of result.experimental_stream) {
          if (progressTracker) {
            progressTracker.onChunk(chunk);
          }
          yield chunk
        }
        progressTracker?.onComplete();
      } else if (result) {
        if (progressTracker) {
          progressTracker.onChunk(result.text);
          progressTracker.onComplete();
        }
        yield result.text
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate text';
      progressTracker?.onChunk(errorMessage);
      progressTracker?.onComplete();
      console.error('Error in asyncIterator:', error)
      yield errorMessage
    }
  }

  const wrapWithAsyncIterable = (promise: Promise<string>): AsyncIterablePromise<string> => {
    return createAsyncIterablePromise({ [Symbol.asyncIterator]: asyncIterator }, promise)
  }

  const baseFn = Object.assign(
    (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult => {
      if (!stringsOrOptions) {
        return wrapWithAsyncIterable(templateFn('', defaultOptions)) as TemplateResult
      }

      if (isTemplateStringsArray(stringsOrOptions)) {
        const strings = stringsOrOptions
        if (strings.length - 1 !== values.length) {
          throw new Error('Template literal slots must match provided values')
        }

        const lastValue = values[values.length - 1]
        const options = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null
          ? { ...defaultOptions, ...lastValue as AIFunctionOptions }
          : defaultOptions
        const actualValues = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null
          ? values.slice(0, -1)
          : values

        const prompt = strings.reduce((acc, str, i) => acc + str + (actualValues[i] || ''), '')
        return wrapWithAsyncIterable(templateFn(prompt, options)) as TemplateResult
      }

      return wrapWithAsyncIterable(templateFn('', { ...defaultOptions, ...stringsOrOptions })) as TemplateResult
    },
    {
      withOptions: (opts: AIFunctionOptions = {}) => {
        const prompt = opts.prompt || currentPrompt || ''
        return templateFn(prompt, { ...defaultOptions, ...opts })
      },
      [Symbol.asyncIterator]: asyncIterator,
      queue
    }
  ) as BaseTemplateFunction

  return baseFn
}
