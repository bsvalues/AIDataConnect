import OpenAI from "openai";
import type { RagEmbedding } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced configuration for RAG
interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxTokens: number;
  temperature: number;
  topK: number;
  modelName: string;
  embeddingModel: string;
}

const DEFAULT_RAG_CONFIG: RagConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxTokens: 500,
  temperature: 0.7,
  topK: 3,
  modelName: "gpt-4o",
  embeddingModel: "text-embedding-3-large"
};

export async function generateEmbedding(text: string, config: Partial<RagConfig> = {}): Promise<number[]> {
  const finalConfig = { ...DEFAULT_RAG_CONFIG, ...config };

  const response = await openai.embeddings.create({
    model: finalConfig.embeddingModel,
    input: text,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

function splitIntoChunks(text: string, config: Partial<RagConfig> = {}): string[] {
  const finalConfig = { ...DEFAULT_RAG_CONFIG, ...config };
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > finalConfig.chunkSize) {
      chunks.push(currentChunk.join(' '));
      // Keep last CHUNK_OVERLAP worth of words for context
      const overlapStart = Math.max(0, currentChunk.length - finalConfig.chunkOverlap);
      currentChunk = currentChunk.slice(overlapStart);
      currentLength = currentChunk.join(' ').length;
    }
    currentChunk.push(word);
    currentLength += word.length + 1; // +1 for space
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks;
}

export async function processDocumentForRag(
  content: string, 
  config: Partial<RagConfig> = {}
): Promise<RagEmbedding[]> {
  const finalConfig = { ...DEFAULT_RAG_CONFIG, ...config };
  const chunks = splitIntoChunks(content, finalConfig);
  const embeddings: RagEmbedding[] = [];

  for (const chunk of chunks) {
    const vector = await generateEmbedding(chunk, finalConfig);
    embeddings.push({ text: chunk, vector });
  }

  return embeddings;
}

export async function findSimilarChunks(
  query: string, 
  embeddings: RagEmbedding[], 
  config: Partial<RagConfig> = {}
): Promise<string[]> {
  const finalConfig = { ...DEFAULT_RAG_CONFIG, ...config };
  const queryVector = await generateEmbedding(query, finalConfig);

  // Calculate cosine similarity with custom top-k
  const similarities = embeddings.map(embedding => ({
    text: embedding.text,
    similarity: cosineSimilarity(queryVector, embedding.vector)
  }));

  // Sort by similarity and get top K results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, finalConfig.topK)
    .map(result => result.text);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function generateRagResponse(
  query: string, 
  context: string[],
  config: Partial<RagConfig> = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_RAG_CONFIG, ...config };

  const response = await openai.chat.completions.create({
    model: finalConfig.modelName,
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant with access to a knowledge base. 
                 Use the provided context to answer questions accurately. 
                 If you cannot find the answer in the context, say so.
                 Always cite the relevant parts of the context in your response.`
      },
      {
        role: "user",
        content: `Context:\n${context.join('\n\n')}\n\nQuestion: ${query}`
      }
    ],
    max_tokens: finalConfig.maxTokens,
    temperature: finalConfig.temperature
  });

  return response.choices[0].message.content || "Failed to generate response";
}

// Analytics for RAG performance
export async function analyzeRagPerformance(
  query: string,
  selectedContext: string[],
  response: string
): Promise<{
  contextRelevance: number;
  responseQuality: number;
  suggestedImprovements: string[];
}> {
  const analysisResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Analyze the RAG system's performance by examining the query, selected context, and response. Provide scores and suggestions in JSON format."
      },
      {
        role: "user",
        content: JSON.stringify({ query, context: selectedContext, response })
      }
    ],
    response_format: { type: "json_object" }
  });

  const analysis = JSON.parse(analysisResponse.choices[0].message.content || "{}");
  return {
    contextRelevance: analysis.contextRelevance || 0,
    responseQuality: analysis.responseQuality || 0,
    suggestedImprovements: analysis.suggestedImprovements || []
  };
}

export async function analyzeFile(content: string): Promise<{
  summary: string;
  category: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Analyze the file content and provide a summary and category. Respond with JSON in this format: { 'summary': string, 'category': string }"
      },
      {
        role: "user",
        content
      }
    ],
    response_format: { type: "json_object" }
  });

  const responseContent = response.choices[0].message.content;
  if (!responseContent) throw new Error("No response from OpenAI");
  return JSON.parse(responseContent);
}

export async function searchFiles(query: string, files: Array<{name: string; content: string}>): Promise<Array<{id: number; relevance: number}>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Given a search query and list of files, rank them by relevance. Return array of {id, relevance} where relevance is 0-1"
      },
      {
        role: "user",
        content: JSON.stringify({ query, files })
      }
    ],
    response_format: { type: "json_object" }
  });

  const responseContent = response.choices[0].message.content;
  if (!responseContent) throw new Error("No response from OpenAI");
  const result = JSON.parse(responseContent);
  return result.results || [];
}

export async function suggestTransformations(data: any): Promise<Array<{
  name: string;
  description: string;
  transformation: string;
}>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert data transformation assistant. Analyze the provided data and suggest practical transformations.
        For each suggestion, provide:
        - A clear name describing the transformation
        - A brief description explaining what it does and why it's useful
        - The actual JavaScript/TypeScript code that can be applied to transform the data

        Focus on common data operations like:
        - Data cleaning (removing duplicates, handling missing values)
        - Type conversions and formatting
        - Filtering and validation
        - Aggregations and calculations
        - String manipulations and standardization

        Return a JSON array of transformation objects with fields: name, description, transformation.
        Make the transformation code practical and immediately usable.`
      },
      {
        role: "user",
        content: JSON.stringify({
          data,
          sample: data instanceof Array ? data.slice(0, 5) : data,
          type: typeof data,
          keys: data ? Object.keys(data) : []
        })
      }
    ],
    response_format: { type: "json_object" }
  });

  const responseContent = response.choices[0].message.content;
  if (!responseContent) throw new Error("No suggestions generated");

  const result = JSON.parse(responseContent);
  return result.transformations || [];
}