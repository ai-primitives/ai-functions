import { z } from 'zod'
import { generateText, generateObject as aiGenerateObject, type GenerateTextResult } from 'ai'
import type { AIFunction, AIFunctionOptions, BaseTemplateFunction } from '../types'
import { QueueManager } from '../queue/manager'
import { createTemplateResult, parseTemplateInput } from '../templates/result'
import { getProvider } from '../providers/config'

async function generateObject<T extends z.ZodType>(
  schema: T,
  args?: z.infer<T>,
  options?: AIFunctionOptions
): Promise<z.infer<T>> {
  const model = options?.model || getProvider()('gpt-4o-mini')
  
  const commonParams = {
    model,
    system: options?.system,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    frequencyPenalty: options?.frequencyPenalty,
    presencePenalty: options?.presencePenalty,
    stopSequences: options?.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
    seed: options?.seed,
    schemaName: options?.schemaName,
    schemaDescription: options?.schemaDescription,
    experimental_providerMetadata: {
      openai: {
        structuredOutputs: true
      }
    }
  }

  // Handle enum output format
  if (schema instanceof z.ZodEnum) {
    const { object } = await aiGenerateObject({
      ...commonParams,
      output: 'enum',
      enum: schema.options,
      prompt: args?.prompt || options?.prompt || 'Select the most appropriate option'
    } as any)
    return schema.parse(object)
  }

  // Handle object output format
  const outputFormat = options?.outputFormat || 'object'
  const prompt = args?.prompt || options?.prompt || (
    args 
      ? `Modify this object based on the provided options: ${JSON.stringify(args)}`
      : 'Generate a new object matching the schema'
  )

  const { object } = await aiGenerateObject({
    ...commonParams,
    output: outputFormat,
    schema,
    prompt
  } as any)

  try {
    return schema.parse(object)
  } catch (error) {
    throw new Error(`Failed to validate generated object against schema: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function createAIFunction<T extends z.ZodType>(schema: T): AIFunction<T> {
  const fn = async function(args?: z.infer<T>, options?: AIFunctionOptions): Promise<z.infer<T>> {
    if (!args) {
      return generateObject(schema, undefined, options)
    }
    return generateObject(schema, args, options)
  }

  fn.schema = schema
  return fn
}

export function createTemplateFunction(defaultOptions: AIFunctionOptions = {}): BaseTemplateFunction {
  const queueManager = new QueueManager()

  const templateFn = async (prompt: string, options: AIFunctionOptions = defaultOptions): Promise<string> => {
    try {
      const model = options.model || getProvider()('gpt-4o-mini')
      const result = await queueManager.executeInQueue(options, () => 
        generateText({
          model,
          prompt,
          system: options.system,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          topP: options.topP,
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.presencePenalty,
          stopSequences: options.stop ? Array.isArray(options.stop) ? options.stop : [options.stop] : undefined,
          seed: options.seed
        })
      )
      return (result as GenerateTextResult<any, any>).text
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to generate text')
    }
  }

  function fn(stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): Promise<string> {
    const { prompt, options } = parseTemplateInput(stringsOrOptions, values, defaultOptions)
    return createTemplateResult(prompt, options, templateFn)
  }

  return Object.assign(fn, {
    withOptions: (options: AIFunctionOptions) => {
      return createTemplateResult('', options, templateFn)
    }
  }) as BaseTemplateFunction
}
