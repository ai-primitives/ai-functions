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
    schemaDescription: options?.schemaDescription
  }

  if (args) {
    // If args are provided, use them as a base for modification
    const { object } = await aiGenerateObject({
      ...commonParams,
      output: 'object',
      schema,
      prompt: `Modify this object based on the provided options: ${JSON.stringify(args)}`
    })
    return object as z.infer<T>
  }

  // If no args, generate a new object
  const { object } = await aiGenerateObject({
    ...commonParams,
    output: 'object',
    schema,
    prompt: 'Generate a new object matching the schema'
  })
  return object as z.infer<T>
}

export function createAIFunction<T extends z.ZodType>(schema: T): AIFunction<T> {
  const fn = async function(args?: z.infer<T>, options?: AIFunctionOptions): Promise<z.infer<T>> {
    if (!args) {
      return schema.parse(await generateObject(schema))
    }
    return schema.parse(await generateObject(schema, args, options))
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

  return fn as BaseTemplateFunction
}
