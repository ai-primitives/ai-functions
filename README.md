# ai-functions

[![npm version](https://badge.fury.io/js/ai-functions.svg)](https://www.npmjs.com/package/ai-functions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript library for building AI-powered applications with template literals and structured outputs. Uses `ai` SDK with OpenAI `gpt-4o` by default.

## Features

- 🚀 Template literal API for natural AI prompts
- 🔄 Async iterator support for streaming responses
- 📝 Structured output generation with Zod schemas
- 🎯 Type-safe API with full TypeScript support
- ⚡️ Built on `ai` SDK for streaming & object generation
- 🔍 Support for various output formats (objects, arrays, enums)

## Installation

```bash
pnpm add ai-functions
```

## Usage

### Basic Template Literals

```typescript
import { ai, list } from 'ai-functions'

// Simple text generation
const text = ai`write a blog post in markdown starting with "# ${title}"`

// Complex objects/arrays dumped to YAML
const summary = ai`Summarize the itinerary: ${itinerary}`

// Basic list generation
const things = await list`fun things to do in Miami`
console.log(things)

// Using async iterator
for await (const thing of list`fun things to do in Miami`) {
  console.log(thing)
}

// Structured output
const categorizeProduct = ai.categorizeProduct({
  productType: 'App | API | Marketplace | Platform | Packaged Service | Professional Service | Website',
  customer: 'ideal customer profile in 3-5 words',
  solution: 'describe the offer in 4-10 words',
  description: 'website meta description',
})

const product = await categorizeProduct({ domain: name })
```

### Configuration

#### Specifying the model

By default `ai-functions` uses the `openai` provider from the `ai` SDK. You can specify any openai model name as a string.

```typescript
const text = ai`write a blog post in markdown starting with "# ${title}"`({ model: 'gpt-4o-mini' })
```

Or you can pass in any other provider compatible with the `ai` SDK.

```typescript
import { anthropic } from '@ai-sdk/anthropic'

const text = ai`write a function in Typescript called ${name}`({ model: anthropic('claude-3-5-sonnet-20241022') })
```

#### Specifying other options

You can pass in any other options supported by the `ai` SDK, like `system`, `temperature`, `maxTokens`, etc.

```typescript
const things = await list`fun things to do in ${city}`({ system: 'You are an expert tour guide', temperature: 0.2 })
```

### Composable Functions & Workflows

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

### Concurrency

you can specify the `concurrency` option to limit the number of concurrent requests.

```typescript
activities.map(async (activity) => {
  const result = await ai`write a paragraph overview of ${activity}`({ concurrency: 5 })
})
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

- `ai` SDK for AI model integration
- Defaults to `@ai-sdk/openai` provider
- TypeScript for static typing
- Zod for schema validation
- Vitest for testing
- ESLint for linting
- Prettier for code formatting
