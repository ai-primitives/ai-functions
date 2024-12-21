import type { AIFunctionOptions, TemplateResult } from '../types'

export function createTemplateResult(
  prompt: string,
  options: AIFunctionOptions,
  templateFn: (prompt: string, options: AIFunctionOptions) => Promise<string>
): TemplateResult {
  const promise = templateFn(prompt, options)
  
  const result = Object.assign(
    (opts?: AIFunctionOptions) => templateFn(prompt, { ...options, ...opts }),
    {
      [Symbol.asyncIterator]: async function* () {
        const response = await templateFn(prompt, options)
        yield response
      },
      call: (opts?: AIFunctionOptions) => templateFn(prompt, { ...options, ...opts }),
      then: (onfulfilled?: ((value: string) => string | PromiseLike<string>) | null | undefined) =>
        templateFn(prompt, options).then(onfulfilled),
      catch: (onrejected?: ((reason: any) => string | PromiseLike<string>) | null | undefined) =>
        templateFn(prompt, options).catch(onrejected),
      finally: (onfinally?: (() => void) | null | undefined) =>
        templateFn(prompt, options).finally(onfinally)
    }
  ) as unknown as TemplateResult

  return result
}

export function parseTemplateInput(
  stringsOrOptions: TemplateStringsArray | AIFunctionOptions | undefined,
  values: unknown[],
  defaultOptions: AIFunctionOptions
): { prompt: string; options: AIFunctionOptions } {
  if (!stringsOrOptions) {
    return { prompt: '', options: defaultOptions }
  }

  if (Array.isArray(stringsOrOptions)) {
    const strings = stringsOrOptions as TemplateStringsArray
    const lastValue = values[values.length - 1]
    const isOptionsObject = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null && Object.keys(lastValue).length > 0
    const options = isOptionsObject
      ? { ...defaultOptions, ...lastValue as AIFunctionOptions }
      : defaultOptions
    const actualValues = isOptionsObject
      ? values.slice(0, -1)
      : values

    if (strings.length - 1 !== actualValues.length) {
      throw new Error('Template literal slots must match provided values')
    }

    const prompt = strings.reduce((acc, str, i) => acc + str + (actualValues[i] || ''), '')
    return { prompt, options }
  }

  return { 
    prompt: '', 
    options: { ...defaultOptions, ...stringsOrOptions }
  }
} 