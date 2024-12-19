# ai-functions

[![npm version](https://badge.fury.io/js/ai-functions.svg)](https://www.npmjs.com/package/ai-functions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript library for building AI-powered applications with template literals and structured outputs. Uses @ai-sdk/openai provider with GPT-4 Turbo by default.

## Features

- 🚀 Template literal API for natural AI prompts
- 🔄 Async iterator support for streaming responses
- 📝 Structured output generation with Zod schemas
- 🎯 Type-safe API with full TypeScript support
- ⚡️ Built on @ai-sdk/openai with GPT-4 Turbo
- 🔍 Support for various output formats (objects, arrays, enums)

## Installation

```bash
pnpm add ai-functions
```

## Usage

### Basic Template Literals

```typescript
import { ai, list } from 'ai-functions'

// Basic list generation
const things = await list`fun things to do in Miami`
console.log(things)

// Using async iterator
for await (const thing of list`fun things to do in Miami`) {
  console.log(thing)
}

// Product categorization
const categorizeProduct = ai.categorizeProduct({
  productType: 'App | API | Marketplace | Platform | Packaged Service | Professional Service | Website',
  customer: 'ideal customer profile in 3-5 words',
  solution: 'describe the offer in 4-10 words',
  description: 'website meta description',
})

const product = await categorizeProduct({ domain: name })
```

### Complex Workflows

```typescript
const listBlogPosts = (count, topic) => list`${count} blog post titles about ${topic}`
const writeBlogPost = (title) => ai`write a blog post in markdown starting with "# ${title}"`

async function* writeBlog(count, topic) {
  for await (const title of listBlogPosts(count, topic)) {
    const content = await writeBlogPost(title)
    yield { title, content }
  }
}

for await (const post of writeBlog(25, 'future of car sales')) {
  console.log({ post })
}
```

### Structured Output Generation

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'

// Basic object generation with schema
const { object } = await generateObject({
  model: 'gpt-4-turbo',
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
})

// Array output with schema
const { object: heroes } = await generateObject({
  model: 'gpt-4-turbo',
  output: 'array',
  schema: z.object({
    name: z.string(),
    class: z.string().describe('Character class, e.g. warrior, mage, or thief.'),
    description: z.string(),
  }),
  prompt: 'Generate 3 hero descriptions for a fantasy role playing game.',
})

// Enum output
const { object: genre } = await generateObject({
  model: 'gpt-4-turbo',
  output: 'enum',
  enum: ['action', 'comedy', 'drama', 'horror', 'sci-fi'],
  prompt: 'Classify the genre of this movie plot: "A group of astronauts travel through a wormhole in search of a new habitable planet for humanity."',
})

// Unstructured output
const { object: recipe } = await generateObject({
  model: 'gpt-4-turbo',
  output: 'no-schema',
  prompt: 'Generate a lasagna recipe.',
})
```

### Streaming Responses

```typescript
import { streamObject, streamText } from 'ai'

// Stream object generation
const { partialObjectStream } = streamObject({
  model: 'gpt-4-turbo',
  prompt: 'Generate a story outline',
})

for await (const partialObject of partialObjectStream) {
  console.log(partialObject)
}

// Stream text generation
const { textStream } = streamText({
  model: 'gpt-4-turbo',
  prompt: 'Invent a new holiday and describe its traditions.',
})

for await (const textPart of textStream) {
  process.stdout.write(textPart)
}
```

### Text Generation

```typescript
import { generateText } from 'ai'

const { text } = await generateText({
  model: 'gpt-4-turbo',
  prompt: 'Invent a new holiday and describe its traditions.',
})

console.log(text)
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Lint the code
pnpm lint

# Format the code
pnpm format
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) to learn about our development process and how to propose bugfixes and improvements.

## License

MIT © [Drivly](https://driv.ly)

## Dependencies

This package uses the following key dependencies:

- @ai-sdk/openai for AI model integration
- TypeScript for static typing
- Zod for schema validation
- Vitest for testing
- ESLint for linting
- Prettier for code formatting
