import { generateText, generateObject, Output, type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { Response } from 'undici'
import { z } from 'zod'
import PQueue from 'p-queue'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue } from '../types'
import { createRequestHandler } from '../utils/request-handler';
import { StreamProgressTracker } from '../utils/stream-progress';
import { AIRequestError } from '../errors'
import { RequestHandlingOptions, TemplateResult } from '../types';

// Add this at the top of the file, before any other code
function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

// PLACEHOLDER: imports and type definitions

export type GenerateResult = GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

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

export function createAIFunction<T extends z.ZodType>(schema: T) {
  const fn = async (args?: z.infer<T>, options: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const requestHandler = createRequestHandler({ requestHandling: options.requestHandling });

    const result = await requestHandler.execute(async () => {
      return generateText({
        model: options.model || getProvider()('gpt-4o-mini') as LanguageModelV1,
        prompt: options.prompt || '',
        maxRetries: 2,
        experimental_output: Output.object({ schema: schema }),
        system: options.system,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
        seed: options.seed,
      });
    });

    if (!result.experimental_output) {
      throw new Error('No output received from model')
    }

    return result.experimental_output
  }

  fn.schema = schema
  return fn as AIFunction<T>
}

// PLACEHOLDER: createTemplateFunction implementation

function getProvider() {
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
  return new Response(result.experimental_stream as unknown as ReadableStream, {
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
    if (!queue && options.concurrency) {
      queue = new PQueue({ concurrency: options.concurrency })
    }
    return queue
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

        const result = (await generateText({
          model: options.model || openai('gpt-4o-mini'),
          prompt,
          ...modelParams,
          ...options,
        })) as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

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

    const options = defaultOptions
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

    try {
      if (options.outputFormat === 'json') {
        const model = options.model || openai(process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o', { structuredOutputs: true })
        let result;
        
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
          result = await generateObject({
            model,
            schema,
            prompt: currentPrompt,
            ...modelParams,
          })
        } else {
          result = await generateObject({
            model,
            output: 'no-schema',
            prompt: currentPrompt,
            ...modelParams,
          })
        }

        if (isStreamingResult(result)) {
          for await (const chunk of result.experimental_stream) {
            if (progressTracker) {
              progressTracker.onChunk(chunk);
            }
            yield chunk
          }
          progressTracker?.onComplete();
        } else {
          const jsonString = JSON.stringify(result.object)
          if (progressTracker) {
            progressTracker.onChunk(jsonString);
            progressTracker.onComplete();
          }
          yield jsonString
        }
      } else {
        const result = (await generateText({
          model: options.model || openai('gpt-4o-mini'),
          prompt: currentPrompt,
          maxRetries: 2,
          ...modelParams,
          ...options,
        })) as GenerateTextResult<Record<string, CoreTool<any, any>>, Record<string, unknown>>

        if (!result) {
          throw new Error('No result received from model')
        }


        if (isStreamingResult(result)) {
          for await (const chunk of result.experimental_stream) {
            if (progressTracker) {
              progressTracker.onChunk(chunk);
            }
            yield chunk
          }
          progressTracker?.onComplete();
        } else {
          if (progressTracker) {
            progressTracker.onChunk(result.text);
            progressTracker.onComplete();
          }
          yield result.text
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate text';
      progressTracker?.onChunk(errorMessage);
      progressTracker?.onComplete();
      console.error('Error in asyncIterator:', error)
      yield errorMessage
    }
  }

  const createAsyncIterablePromise = <T extends string>(promise: Promise<T>, prompt: string, options: AIFunctionOptions = defaultOptions): AsyncIterablePromise<T> => {
    // Create the base promise
    const basePromise = promise;

    // Create the response function
    function responseFunction(opts?: AIFunctionOptions): Promise<T> {
      if (!opts) return basePromise;
      const mergedOptions = { ...options, ...opts };
      currentPrompt = prompt;
      return templateFn(prompt, mergedOptions) as Promise<T>;
    }

    // Create the async iterator function
    const iteratorFn = function(): AsyncIterator<string> {
      const iter = asyncIterator();
      return {
        next(): Promise<IteratorResult<string>> {
          return iter.next();
        },
        return(): Promise<IteratorResult<string>> {
          return Promise.resolve({ done: true, value: undefined });
        },
        throw(error?: any): Promise<IteratorResult<string>> {
          return Promise.reject(error);
        }
      };
    };

    // Define Promise methods and asyncIterator
    const properties = {
      then: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: basePromise.then.bind(basePromise)
      },
      catch: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: basePromise.catch.bind(basePromise)
      },
      finally: {
        enumerable: true,
        configurable: true,
        writable: true,
        value: basePromise.finally.bind(basePromise)
      }
    };

    // Explicitly define Symbol.asyncIterator
    Object.defineProperty(responseFunction, Symbol.asyncIterator, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: iteratorFn
    });

    Object.defineProperties(responseFunction, properties);

    // Set the prototype to Promise.prototype
    Object.setPrototypeOf(responseFunction, Promise.prototype);

    return responseFunction as AsyncIterablePromise<T>;
  }

  const baseFn = Object.assign(
    (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult => {
      if (!stringsOrOptions) {
        return createAsyncIterablePromise(templateFn('', defaultOptions), '', defaultOptions) as TemplateResult
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
        return createAsyncIterablePromise(templateFn(prompt, options), prompt, options) as TemplateResult
      }

      return createAsyncIterablePromise(templateFn('', { ...defaultOptions, ...stringsOrOptions }), '', { ...defaultOptions, ...stringsOrOptions }) as TemplateResult
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
