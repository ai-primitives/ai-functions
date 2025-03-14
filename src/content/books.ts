import { z } from 'zod'
import { createAIFunction } from '../src/factory'

// Create the writeBook function with proper schema
const writeBook = createAIFunction(
  z.object({
    title: z.string().describe('title of the book'),
    author: z.string().describe('name of the author'),
    genre: z.string().describe('genre of the book'),
    audience: z.string().describe('target audience for the book'),
    content: z.string().describe('complete book content'),
  }),
)

// Create the developProposal function with proper schema
const developProposal = createAIFunction(
  z.object({
    title: z.string().describe('proposed title of the book'),
    genre: z.string().describe('genre of the book'),
    audience: z.string().describe('target audience for the book'),
    concept: z.string().describe('high-level concept of the book'),
    marketAnalysis: z.string().describe('analysis of the target market'),
    competitiveAnalysis: z.string().describe('analysis of competing books'),
    uniqueSellingPoints: z.array(z.string()).describe('unique selling points of the book'),
    outline: z.string().describe('brief outline of the book'),
  }),
)

// Create the draftTableOfContents function with proper schema
const draftTableOfContents = createAIFunction(
  z.object({
    title: z.string().describe('title of the book'),
    genre: z.string().describe('genre of the book'),
    chapters: z
      .array(
        z.object({
          title: z.string().describe('title of the chapter'),
          summary: z.string().describe('brief summary of the chapter content'),
        }),
      )
      .describe('list of chapters with titles and summaries'),
    frontMatter: z.array(z.string()).describe('front matter sections like preface, introduction, etc.'),
    backMatter: z.array(z.string()).describe('back matter sections like appendices, glossary, etc.'),
  }),
)

// Create the outlineChapter function with proper schema
const outlineChapter = createAIFunction(
  z.object({
    chapterTitle: z.string().describe('title of the chapter'),
    chapterNumber: z.number().describe('number of the chapter in the book'),
    keyPoints: z.array(z.string()).describe('key points to cover in the chapter'),
    scenes: z
      .array(
        z.object({
          title: z.string().describe('title or brief description of the scene'),
          summary: z.string().describe('summary of what happens in the scene'),
          characters: z.array(z.string()).optional().describe('characters involved in the scene'),
        }),
      )
      .optional()
      .describe('scenes within the chapter (for fiction)'),
    sections: z
      .array(
        z.object({
          heading: z.string().describe('section heading'),
          content: z.string().describe('brief description of section content'),
        }),
      )
      .optional()
      .describe('sections within the chapter (for non-fiction)'),
  }),
)

// Create the writeSection function with proper schema
const writeSection = createAIFunction(
  z.object({
    sectionTitle: z.string().describe('title of the section'),
    chapterTitle: z.string().describe('title of the parent chapter'),
    keyPoints: z.array(z.string()).describe('key points to cover in the section'),
    tone: z.string().describe('tone of the writing (formal, conversational, etc.)'),
    content: z.string().describe('complete section content'),
  }),
)

// Create the reviewChapter function with proper schema
const reviewChapter = createAIFunction(
  z.object({
    chapterTitle: z.string().describe('title of the chapter'),
    content: z.string().describe('content of the chapter'),
    feedback: z.string().describe('detailed feedback on the chapter'),
    strengthPoints: z.array(z.string()).describe('strengths of the chapter'),
    improvementPoints: z.array(z.string()).describe('areas for improvement'),
    consistencyIssues: z.array(z.string()).optional().describe('consistency issues with other parts of the book'),
  }),
)

// Create the editChapter function with proper schema
const editChapter = createAIFunction(
  z.object({
    chapterTitle: z.string().describe('title of the chapter'),
    originalContent: z.string().describe('original content of the chapter'),
    editedContent: z.string().describe('edited content of the chapter'),
    changes: z.array(z.string()).describe('list of changes made'),
    rationale: z.string().describe('rationale for the changes'),
  }),
)

// Create the reviewBook function with proper schema
const reviewBook = createAIFunction(
  z.object({
    title: z.string().describe('title of the book'),
    content: z.string().describe('content of the book or summary of content'),
    overallFeedback: z.string().describe('overall feedback on the book'),
    strengthPoints: z.array(z.string()).describe('strengths of the book'),
    improvementPoints: z.array(z.string()).describe('areas for improvement'),
    marketFit: z.string().describe('assessment of how well the book fits its target market'),
    recommendations: z.array(z.string()).describe('recommendations for improvement'),
  }),
)

// Create the editBook function with proper schema
const editBook = createAIFunction(
  z.object({
    title: z.string().describe('title of the book'),
    originalContent: z.string().describe('original content or summary of the book'),
    editedContent: z.string().describe('edited content or summary of changes'),
    majorChanges: z.array(z.string()).describe('list of major changes made'),
    minorChanges: z.array(z.string()).describe('list of minor changes made'),
    rationale: z.string().describe('rationale for the changes'),
  }),
)

// Create the publishBook function with proper schema
const publishBook = createAIFunction(
  z.object({
    title: z.string().describe('title of the book'),
    author: z.string().describe('name of the author'),
    finalContent: z.string().describe('final content or confirmation of completion'),
    publishingPlatforms: z.array(z.string()).describe('platforms where the book will be published'),
    marketingPlan: z.string().describe('plan for marketing the book'),
    launchDate: z.string().describe('planned launch date'),
    pricingStrategy: z.string().describe('pricing strategy for the book'),
    distributionChannels: z.array(z.string()).describe('channels for book distribution'),
  }),
)

// Export the functions
export { writeBook, developProposal, draftTableOfContents, outlineChapter, writeSection, reviewChapter, editChapter, reviewBook, editBook, publishBook }
