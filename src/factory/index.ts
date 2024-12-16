import { z } from 'zod'
import { generateObject, generateText, streamText, LanguageModelV1 } from 'ai'
import { openai } from '@ai-sdk/openai'
import { AIFunction, AIFunctionOptions, BaseTemplateFunction } from '../types'
import { createSchemaFromTemplate } from '../utils/schema'

const DEFAULT_MODEL: LanguageModelV1 = openai('gpt-4o')

export function createAIFunction<T extends Record<string, string>>(
  template: T,
  options: AIFunctionOptions = {}
): AIFunction<{
  [K in keyof T]: string
}> {
  const schema = createSchemaFromTemplate(template)

  const fn = async (args?: Record<string, any>, fnOptions: AIFunctionOptions = {}) => {
    if (!args) {
      return { schema }
    }

    const { object } = await generateObject({
      model: DEFAULT_MODEL,
      schema,
      prompt: `Generate a response for: ${JSON.stringify(args)}`,
      ...options,
      ...fnOptions
    })

    return object
  }

  Object.assign(fn, { schema })

  return fn as AIFunction<{ [K in keyof T]: string }>
}

export function createTemplateFunction(options: AIFunctionOptions = {}): BaseTemplateFunction {
  const templateFn = async (prompt: string) => {
    const { text } = await generateText({
      model: DEFAULT_MODEL,
      prompt,
      ...options
    })
    return text
  }

  templateFn.withOptions = async (opts: AIFunctionOptions = {}) => {
    return templateFn(opts.prompt || '')
  }

  let currentPrompt: string | undefined

  const wrappedCall = (async function(
    this: BaseTemplateFunction,
    stringsOrOptions: TemplateStringsArray | AIFunctionOptions,
    ...values: any[]
  ): Promise<string> {
    if (!Array.isArray(stringsOrOptions)) {
      const opts = stringsOrOptions as AIFunctionOptions
      currentPrompt = opts.prompt
      return templateFn.withOptions(opts)
    }

    const prompt = String.raw({ raw: stringsOrOptions }, ...values)
    currentPrompt = prompt
    return templateFn.withOptions({ prompt })
  }) as unknown as BaseTemplateFunction

  Object.defineProperty(wrappedCall, Symbol.asyncIterator, {
    value: async function*() {
      const prompt = currentPrompt || await this.withOptions()

      const { textStream } = await streamText({
        model: DEFAULT_MODEL,
        prompt,
        ...options
      })

      for await (const chunk of textStream) {
        yield chunk
      }
    },
    writable: true,
    configurable: true
  })

  Object.assign(wrappedCall, {
    withOptions: templateFn.withOptions
  })

  return wrappedCall
}
