import { z } from 'zod'

export interface AIFunctionOptions {
  model?: string
}

export type AIFunction<T extends Record<string, any> = Record<string, any>> = {
  (): Promise<{ schema: z.ZodSchema }>
  (args: T): Promise<T>
  (args: T, options: AIFunctionOptions): Promise<T>
  schema?: z.ZodSchema
}

export type AITemplateFunction = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<string>
  (strings: TemplateStringsArray, ...values: any[]): {
    (options?: AIFunctionOptions): Promise<string>
  }
  [Symbol.asyncIterator](): AsyncIterator<string>
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

export type ListFunction = AITemplateFunction
