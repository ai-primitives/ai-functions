import { createAIFunction, createTemplateFunction } from './factory'
import { AI, ListFunction } from './types'

// Create the main template function
const templateFn = createTemplateFunction()

// Create the categorizeProduct function with proper typing
const categorizeProduct = createAIFunction({
  productType: 'App | API | Marketplace | Platform | Packaged Service | Professional Service | Website',
  customer: 'ideal customer profile in 3-5 words',
  solution: 'describe the offer in 4-10 words',
  description: 'website meta description',
})

// Create the main AI object with template literal support and categorizeProduct
export const ai = Object.assign(templateFn, {
  categorizeProduct,
}) as AI

// Create the list function with template literal support
export const list: ListFunction = createTemplateFunction()

// Export types for consumers
export * from './types'
