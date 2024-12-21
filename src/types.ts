import { z } from 'zod'
import { LanguageModelV1 } from '@ai-sdk/provider'

export type AIFunctionOptions = {
  outputFormat?: 'object' | 'array' | 'enum' | 'no-schema'
  schema?: z.ZodType
  enum?: string[]
  schemaName?: string
  schemaDescription?: string
  model?: LanguageModelV1
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string | string[]
  seed?: number
  system?: string
  prompt?: string
  signal?: AbortSignal
  streaming?: {
    onProgress?: (chunk: string) => void
    enableTokenCounting?: boolean
  }
}

export type TemplateResult = Promise<string> & {
  call: (opts?: AIFunctionOptions) => Promise<string>
  [Symbol.asyncIterator]: () => AsyncIterator<string>
} & AsyncIterable<string>

export type BaseTemplateFunction = {
  (strings: TemplateStringsArray, ...values: any[]): TemplateResult
  withOptions: (options: AIFunctionOptions) => TemplateResult
}

export type AIFunction<T extends z.ZodType> = {
  (args?: z.infer<T>, options?: AIFunctionOptions): Promise<z.infer<T>>
  schema: T
}

export type ListFunction = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<string>
  withOptions: (options: AIFunctionOptions) => Promise<string> & AsyncIterable<string>
}
