import { generateText, streamText, generateObject, Output, type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible, type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { Response } from 'undici'
import { z } from 'zod'
import PQueue from 'p-queue'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction, AsyncIterablePromise, Queue, TemplateResult } from '../types'
import { createRequestHandler, type RequestHandlingOptions } from '../utils/request-handler'
import { StreamProgressTracker } from '../utils/stream-progress'
import { AIRequestError } from '../errors'

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

    const result = await requestHandler.add(async () => {
      return generateText({
        model: options.model || getProvider()('gpt-4o-mini') as LanguageModelV1,
        prompt: options.prompt || '',
        maxRetries: 2,
        experimental_output: Output.object({ schema }),
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

export function createTemplateFunction(): BaseTemplateFunction {
  const templateFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
    if (!isTemplateStringsArray(stringsOrOptions)) {
      return templateFn`${stringsOrOptions || ''}`
    }

    const prompt = String.raw({ raw: stringsOrOptions }, ...values)
    
    const fn = async (options: AIFunctionOptions = {}) => {
      const requestHandler = createRequestHandler({ requestHandling: options.requestHandling })
      
      const model = options.model || getProvider()('gpt-4o-mini', { 
        structuredOutputs: options.outputFormat === 'json' 
      }) as LanguageModelV1

      if (options.outputFormat === 'json') {
        const result = await requestHandler.add(async () => {
          let schema: z.ZodType
          if (options.schema) {
            if (options.schema instanceof z.ZodType) {
              schema = options.schema
            } else {
              schema = z.object(Object.fromEntries(
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
            }
          } else {
            schema = z.unknown()
          }

          const result = await generateText({
            model,
            prompt: `You must respond with a valid JSON object. ${prompt}`,
            experimental_output: Output.object({ schema }),
            system: options.system ? `${options.system} You must respond with valid JSON.` : 'You must respond with valid JSON.',
            temperature: options.temperature ?? 0,
            maxTokens: options.maxTokens,
            topP: options.topP ?? 1,
            frequencyPenalty: options.frequencyPenalty ?? 0,
            presencePenalty: options.presencePenalty ?? 0,
            stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
            seed: options.seed,
          })

          if (!result.experimental_output) {
            throw new AIRequestError('No output received from model', undefined, true)
          }

          return JSON.stringify(result.experimental_output)
        })
        
        const templateResult = Object.create(Promise.resolve(result), {
          [Symbol.asyncIterator]: {
            value: async function* () {
              yield result
            },
            writable: true,
            configurable: true
          },
          call: {
            value: async (opts?: AIFunctionOptions) => result,
            writable: true,
            configurable: true
          },
          then: {
            value: Promise.resolve(result).then.bind(Promise.resolve(result)),
            writable: true,
            configurable: true
          },
          catch: {
            value: Promise.resolve(result).catch.bind(Promise.resolve(result)),
            writable: true,
            configurable: true
          },
          finally: {
            value: Promise.resolve(result).finally.bind(Promise.resolve(result)),
            writable: true,
            configurable: true
          }
        }) as TemplateResult
        
        return templateResult
      }
      
      if (options.streaming?.onProgress) {
        const result = await streamText({
          model,
          prompt,
          system: options.system,
          temperature: options.temperature ?? 0,
          maxTokens: options.maxTokens,
          topP: options.topP ?? 1,
          frequencyPenalty: options.frequencyPenalty ?? 0,
          presencePenalty: options.presencePenalty ?? 0,
          stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
          seed: options.seed,
          onChunk: ({ chunk }) => {
            if (chunk.type === 'text-delta') {
              options.streaming?.onProgress?.({
                type: 'chunk',
                chunk: chunk.textDelta
              })
            }
          }
        })
        
        const templateResult = Object.create(Promise.resolve(result.text), {
          [Symbol.asyncIterator]: {
            value: () => result.textStream[Symbol.asyncIterator](),
            writable: true,
            configurable: true
          },
          call: {
            value: async (opts?: AIFunctionOptions) => result.text,
            writable: true,
            configurable: true
          },
          then: {
            value: Promise.resolve(result.text).then.bind(Promise.resolve(result.text)),
            writable: true,
            configurable: true
          },
          catch: {
            value: Promise.resolve(result.text).catch.bind(Promise.resolve(result.text)),
            writable: true,
            configurable: true
          },
          finally: {
            value: Promise.resolve(result.text).finally.bind(Promise.resolve(result.text)),
            writable: true,
            configurable: true
          }
        }) as TemplateResult
        
        return templateResult
      }
      
      const result = await requestHandler.add(async () => {
        return generateText({
          model,
          prompt,
          system: options.system,
          temperature: options.temperature ?? 0,
          maxTokens: options.maxTokens,
          topP: options.topP ?? 1,
          frequencyPenalty: options.frequencyPenalty ?? 0,
          presencePenalty: options.presencePenalty ?? 0,
          stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
          seed: options.seed,
        })
      })
      
      const templateResult = Object.create(Promise.resolve(result.text), {
        [Symbol.asyncIterator]: {
          value: async function* () {
            yield result.text
          },
          writable: true,
          configurable: true
        },
        call: {
          value: async (opts?: AIFunctionOptions) => result.text,
          writable: true,
          configurable: true
        },
        then: {
          value: Promise.resolve(result.text).then.bind(Promise.resolve(result.text)),
          writable: true,
          configurable: true
        },
        catch: {
          value: Promise.resolve(result.text).catch.bind(Promise.resolve(result.text)),
          writable: true,
          configurable: true
        },
        finally: {
          value: Promise.resolve(result.text).finally.bind(Promise.resolve(result.text)),
          writable: true,
          configurable: true
        }
      }) as TemplateResult
      
      return templateResult
    }
    
    const templatePromise = Promise.resolve(fn())
    const templateResult = Object.create(templatePromise, {
      [Symbol.asyncIterator]: {
        value: async function* () {
          const result = await streamText({
            model: getProvider()('gpt-4o-mini') as LanguageModelV1,
            prompt,
            onChunk: ({ chunk }) => {
              if (chunk.type === 'text-delta') {
                void chunk.textDelta
              }
            }
          })
          for await (const chunk of result.textStream) {
            yield chunk
          }
        },
        writable: true,
        configurable: true
      },
      call: {
        value: fn,
        writable: true,
        configurable: true
      },
      then: {
        value: templatePromise.then.bind(templatePromise),
        writable: true,
        configurable: true
      },
      catch: {
        value: templatePromise.catch.bind(templatePromise),
        writable: true,
        configurable: true
      },
      finally: {
        value: templatePromise.finally.bind(templatePromise),
        writable: true,
        configurable: true
      }
    }) as TemplateResult
    
    return templateResult
  }
  
  // Add required properties to make it a BaseTemplateFunction
  Object.defineProperties(templateFn, {
    [Symbol.asyncIterator]: {
      value: function () {
        return templateFn``[Symbol.asyncIterator]()
      },
      writable: true,
      configurable: true,
    },
    queue: {
      value: undefined,
      configurable: true,
    },
    withOptions: {
      value: (options?: AIFunctionOptions) => templateFn(options || {}),
      writable: true,
      configurable: true,
    }
  })
  
  return templateFn as BaseTemplateFunction
}
