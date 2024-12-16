import { z } from 'zod'
import { LanguageModelV1 } from 'ai'

export interface AIFunctionOptions {
  model?: LanguageModelV1
  prompt?: string
}

export type AIFunction<T extends Record<string, any> = Record<string, any>> = {
  (): Promise<{ schema: z.ZodSchema }>
  (args: T): Promise<T>
  (args: T, options: AIFunctionOptions): Promise<T>
  schema?: z.ZodSchema
}

export interface BaseTemplateFunction extends AsyncIterable<string> {
  (strings: TemplateStringsArray, ...values: any[]): Promise<string> | AsyncIterable<string>
  (options?: AIFunctionOptions): Promise<string>
  withOptions: (options?: AIFunctionOptions) => Promise<string>
  [Symbol.asyncIterator](): AsyncIterator<string>
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: any[]): Promise<string>
  withOptions: (options?: AIFunctionOptions) => Promise<string>
}

export interface AI extends AITemplateFunction {
  categorizeProduct: AIFunction<{
    productType?: string
    customer?: string
    solution?: string
    description?: string
    domain?: string
  }>
}

export type ListFunction = BaseTemplateFunction
