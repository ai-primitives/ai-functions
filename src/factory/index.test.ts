import { describe, expect, it, beforeEach } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction, createAIFunction } from './index'
import type { AIFunctionOptions } from '../types'
import { openai } from '@ai-sdk/openai'
// import { anthropic } from '@ai-sdk/anthropic' // Commented out as it's just for test demonstration

describe('Template Function', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini')

  describe('Template Literals', () => {
    it('should support markdown generation', async () => {
      const ai = createTemplateFunction()
      const title = 'AI Functions'
      const result = await ai`write a blog post in markdown starting with "# ${title}"`({ model })
      expect(result).toMatch(/^# AI Functions/)
      expect(result).toContain('# ')
      expect(result).toContain('\n')
    }, 30000)

    // it('should support complex object summarization', async () => {
    //   const ai = createTemplateFunction()
    //   const itinerary = {
    //     dates: ['2024-01-01', '2024-01-02'],
    //     location: 'Miami Beach',
    //     activities: ['Swimming', 'Surfing']
    //   }
    //   const result = await ai`Summarize the itinerary: ${JSON.stringify(itinerary)}`({ model })
    //   expect(result).toContain('Miami Beach')
    //   expect(result).toMatch(/[Ss]wimming/)
    // })

    it('should support multiple interpolated values', async () => {
      const ai = createTemplateFunction()
      const city = 'Paris'
      const days = 3
      const interests = ['art', 'food']
      const result = await ai`Create an itinerary for ${days} days in ${city} focusing on ${interests.join(' and ')}`({ model })
      expect(result).toContain('Paris')
      expect(result).toContain('art')
      expect(result).toContain('food')
    }, 30000)
  })

  // describe('Structured Outputs', () => {
  //   it('should support getting and using schema functions', async () => {
  //     const ai = new Proxy(createTemplateFunction(), {
  //       get: (target, prop) => {
  //         if (prop === 'categorizeProduct') {
  //           return createAIFunction(z.object({
  //             productType: z.enum(['App', 'API', 'Marketplace', 'Platform', 'Service', 'Website']),
  //             customer: z.string().describe('ideal customer profile'),
  //             solution: z.string().describe('describe the offer'),
  //             description: z.string().describe('website meta description')
  //           }))
  //         }
  //         return target[prop]
  //       }
  //     })

  //     // Get the function and use it later
  //     const categorizeProduct = ai.categorizeProduct
  //     const result1 = await categorizeProduct({ domain: 'stripe.com' }, { model })
  //     expect(result1).toHaveProperty('productType')
  //     expect(result1).toHaveProperty('customer')
  //     expect(result1).toHaveProperty('solution')
  //     expect(result1).toHaveProperty('description')
  //     expect(['App', 'API', 'Marketplace', 'Platform', 'Service', 'Website']).toContain(result1.productType)

  //     // Immediate invocation pattern
  //     const result2 = await ai.categorizeProduct({
  //       productType: 'App | API | Marketplace | Platform | Service | Website',
  //       customer: 'ideal customer profile',
  //       solution: 'describe the offer',
  //       description: 'website meta description',
  //     })({ name: 'drively AI' }, { model })

  //     expect(result2).toHaveProperty('productType')
  //     expect(result2).toHaveProperty('customer')
  //     expect(result2).toHaveProperty('solution')
  //     expect(result2).toHaveProperty('description')
  //     expect(['App', 'API', 'Marketplace', 'Platform', 'Service', 'Website']).toContain(result2.productType)
  //   }, 30000)

  //   it('should support enum output format', async () => {
  //     const ai = new Proxy(createTemplateFunction(), {
  //       get: (target, prop) => {
  //         if (prop === 'classifyMovie') {
  //           return createAIFunction(z.enum(['action', 'comedy', 'drama', 'horror', 'sci-fi']))
  //         }
  //         return target[prop]
  //       }
  //     })
      
  //     // Get the function and use it later
  //     const classifyMovie = ai.classifyMovie
  //     const result1 = await classifyMovie({
  //       plot: 'A group of astronauts travel through a wormhole in search of a new habitable planet for humanity.'
  //     }, { model })
  //     expect(['action', 'comedy', 'drama', 'horror', 'sci-fi']).toContain(result1)

  //     // Immediate invocation pattern
  //     const result2 = await ai.classifyMovie({
  //       genre: ['action', 'comedy', 'drama', 'horror', 'sci-fi']
  //     })({ 
  //       plot: 'A detective investigates a series of mysterious disappearances in a small town.'
  //     }, { model })
  //     expect(['action', 'comedy', 'drama', 'horror', 'sci-fi']).toContain(result2)
  //   }, 30000)
  // })

  describe('Configuration', () => {
    it('should support model specification', async () => {
      const ai = createTemplateFunction()
      const result = await ai`Hello`({ model: openai('gpt-4o-mini') })
      expect(result).toBeDefined()
    })

    it('should support system prompts', async () => {
      const ai = createTemplateFunction()
      const result = await ai`List fun activities`({
        model,
        system: 'You are an expert tour guide',
        temperature: 0.2
      })
      expect(result).toBeDefined()
    })

    it('should support concurrency limits', async () => {
      const ai = createTemplateFunction()
      const startTime = Date.now()
      
      const results = await Promise.all([
        ai`task 1`({ model, concurrency: 2 }),
        ai`task 2`({ model, concurrency: 2 }),
        ai`task 3`({ model, concurrency: 2 })
      ])

      const endTime = Date.now()
      expect(results).toHaveLength(3)
      // With concurrency of 2, it should take at least 2 batches
      expect(endTime - startTime).toBeGreaterThan(100)
    })
  })

//   describe('Composable Functions & Workflows', () => {
//     it('should support function composition', async () => {
//       const ai = createTemplateFunction()
//       const list = createTemplateFunction()

//       const listBlogPosts = (count: number, topic: string) => 
//         list`${count} blog post titles about ${topic}`({ model })
//       const writeBlogPost = (title: string) => 
//         ai`write a blog post in markdown starting with "# ${title}"`({ model })

//       async function* writeBlog(count: number, topic: string) {
//         for await (const title of await listBlogPosts(count, topic)) {
//           const content = await writeBlogPost(title)
//           yield { title, content }
//         }
//       }

//       const posts = []
//       for await (const post of writeBlog(2, 'future of car sales')) {
//         posts.push(post)
//       }

//       expect(posts).toHaveLength(2)
//       posts.forEach(post => {
//         expect(post).toHaveProperty('title')
//         expect(post).toHaveProperty('content')
//         expect(post.content).toMatch(new RegExp(`^# ${post.title}`))
//       })
//     })

//     it('should support nested template functions', async () => {
//       const ai = createTemplateFunction()
//       const generateName = (type: string) => ai`generate a name for a ${type}`({ model })
//       const generateFunction = (name: string) => 
//         ai`write a function in TypeScript called ${name}`({ model })

//       const name = await generateName('utility function')
//       const result = await generateFunction(name)
      
//       expect(result).toContain('function')
//       expect(result).toContain(name)
//       expect(result).toContain('export')
//     })
//   })

//   describe('Alternative Providers', () => {
//     it('should support OpenAI provider', async () => {
//       const ai = createTemplateFunction()
//       const result = await ai`Hello`({ model: openai('gpt-4o-mini') })
//       expect(result).toBeDefined()
//     })

//     // This test is commented out as we don't want to actually import anthropic
//     // but it demonstrates how the test would look
//     /*
//     it('should support Anthropic provider', async () => {
//       const ai = createTemplateFunction()
//       const result = await ai`write a function in TypeScript called ${name}`({ 
//         model: anthropic('claude-3-5-sonnet-20241022')
//       })
//       expect(result).toContain('function')
//       expect(result).toContain('export')
//     })
//     */

//     it('should support custom provider configuration', async () => {
//       const ai = createTemplateFunction()
//       const result = await ai`Hello`({ 
//         model: openai('gpt-4o-mini', { structuredOutputs: true })
//       })
//       expect(result).toBeDefined()
//     })
//   })

//   describe('Advanced Features', () => {
//     it('should support streaming with onChunk callback', async () => {
//       const ai = createTemplateFunction()
//       const chunks: string[] = []

//       const result = await ai`Write a short story`({
//         model,
//         streaming: {
//           onProgress: (chunk) => chunks.push(chunk)
//         }
//       })

//       expect(result).toBeDefined()
//       expect(chunks.length).toBeGreaterThan(0)
//       expect(chunks.join('')).toBe(result)
//     })

//     it('should support structured outputs with OpenAI', async () => {
//       const schema = z.object({
//         name: z.string(),
//         ingredients: z.array(z.object({
//           name: z.string(),
//           amount: z.string().nullable() // Note: using nullable instead of optional
//         })),
//         steps: z.array(z.string())
//       })

//       const ai = createTemplateFunction()
//       const result = await ai`Generate a recipe`({
//         model: openai('gpt-4o-mini', { structuredOutputs: true }),
//         outputFormat: 'object',
//         schema,
//         schemaName: 'recipe',
//         schemaDescription: 'A cooking recipe with ingredients and steps.'
//       })

//       const parsed = JSON.parse(result)
//       expect(() => schema.parse(parsed)).not.toThrow()
//     })

//     it('should support long text generation', async () => {
//       const ai = createTemplateFunction()
//       const result = await ai`Write a detailed essay about the history of Rome`({
//         model,
//         maxSteps: 3,
//         experimental_continueSteps: true,
//         system: 'Stop when sufficient information was provided.'
//       })

//       expect(result.length).toBeGreaterThan(1000) // Assuming it generates substantial content
//       expect(result).toContain('Rome')
//     })

//     it('should support predicted outputs', async () => {
//       const ai = createTemplateFunction()
//       const existingCode = `interface User {
//         Username: string;
//         Age: number;
//       }`

//       const result = await ai`Replace the Username property with an Email property`({
//         model,
//         experimental_providerMetadata: {
//           openai: {
//             prediction: {
//               type: 'content',
//               content: existingCode
//             }
//           }
//         }
//       })

//       expect(result).toContain('interface User')
//       expect(result).toContain('Email: string')
//       expect(result).not.toContain('Username')
//     })

//     it('should support streaming with tool calls', async () => {
//       const ai = createTemplateFunction()
//       const toolCalls: any[] = []
//       const toolResults: any[] = []

//       await ai`What are some San Francisco tourist attractions?`({
//         model,
//         tools: {
//           cityAttractions: {
//             parameters: z.object({ city: z.string() }),
//             execute: async ({ city }) => ({
//               attractions: ['Alcatraz', 'Golden Gate Bridge', 'Fisherman\'s Wharf']
//             })
//           }
//         },
//         streaming: {
//           onProgress: (chunk) => {
//             if (chunk.type === 'tool-call') toolCalls.push(chunk)
//             if (chunk.type === 'tool-result') toolResults.push(chunk)
//           }
//         }
//       })

//       expect(toolCalls.length).toBeGreaterThan(0)
//       expect(toolResults.length).toBeGreaterThan(0)
//       expect(toolCalls[0].toolName).toBe('cityAttractions')
//     })
//   })
// })
})