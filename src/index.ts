import { z } from 'zod'
import { createTemplateFunction } from './factory'
import { createListFunction } from './factory/list'
import type { AIFunctionOptions, BaseTemplateFunction } from './types'

export const ai = createTemplateFunction()
export const list = createListFunction()

export { createAIFunction } from './factory'
export { createTemplateFunction } from './factory'
export { createListFunction } from './factory/list'
export * from './types'
