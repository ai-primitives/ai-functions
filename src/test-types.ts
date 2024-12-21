import { type GenerateTextResult, type GenerateObjectResult, type JSONValue, type CoreTool, type ToolResultContent } from 'ai'
import { Response } from '@ai-sdk/provider-utils'

export type MockGenerateTextResult = GenerateTextResult<
  Record<string, CoreTool<any, any>>,
  Record<string, unknown>
>

export type MockGenerateObjectResult = GenerateTextResult<
  Record<string, CoreTool<any, any>>,
  Record<string, unknown>
> & {
  object: JSONValue
  toJsonResponse: () => Response
}

export const createMockTextResponse = (text: string): MockGenerateTextResult => ({
  text,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  response: {
    id: '1',
    timestamp: new Date(),
    modelId: 'test-model',
    messages: [{ role: 'assistant' as const, content: text }] as const,
  },
  finishReason: 'stop',
  warnings: [],
  request: {},
  logprobs: undefined,
  toolCalls: [],
  toolResults: [],
  steps: [],
  experimental_output: {},
  experimental_providerMetadata: {},
})

export const createMockObjectResponse = <T extends JSONValue>(object: T): MockGenerateObjectResult => ({
  text: JSON.stringify(object),
  object,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  response: {
    id: '1',
    timestamp: new Date(),
    modelId: 'test-model',
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
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  },
})
