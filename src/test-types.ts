import { type GenerateTextResult, type JSONValue, type CoreTool } from 'ai'
import { Response } from 'undici'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MockGenerateTextResult = GenerateTextResult<
  Record<string, CoreTool<any, any>>,
  JSONValue
>

export type MockGenerateObjectResult = GenerateTextResult<
  Record<string, CoreTool<any, any>>,
  JSONValue
> & {
  object: JSONValue
  toJsonResponse: () => Response
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createMockTextResponse = (text: string): MockGenerateTextResult => ({
  text,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  response: {
    id: '1',
    timestamp: new Date(),
    modelId: 'test-model',
    messages: [{ role: 'assistant' as const, content: text }],
  },
  finishReason: 'stop',
  warnings: [],
  request: {},
  logprobs: undefined,
  toolCalls: [],
  toolResults: [],
  steps: [],
  experimental_output: null,
  experimental_providerMetadata: {},
})

export const createMockObjectResponse = (object: JSONValue): MockGenerateObjectResult => ({
  text: JSON.stringify(object),
  object,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  response: {
    id: '1',
    timestamp: new Date(),
    modelId: 'test-model',
    messages: [{ role: 'assistant' as const, content: JSON.stringify(object) }],
  },
  finishReason: 'stop',
  warnings: [],
  request: {},
  logprobs: undefined,
  toolCalls: [],
  toolResults: [],
  steps: [],
  experimental_output: object,
  experimental_providerMetadata: {},
  toJsonResponse: () =>
    new Response(JSON.stringify(object), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
})

export const createMockStreamResponse = (chunks: string[]): MockGenerateTextResult & {
  experimental_stream: AsyncIterable<string>
} => ({
  ...createMockTextResponse(chunks.join('')),
  experimental_stream: {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  },
})
