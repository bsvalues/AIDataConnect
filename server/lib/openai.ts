import OpenAI from "openai";
import type { RagEmbedding } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Chunk size for text splitting
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;


export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

function splitIntoChunks(text: string): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentLength + word.length > CHUNK_SIZE) {
      chunks.push(currentChunk.join(' '));
      // Keep last CHUNK_OVERLAP worth of words for context
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP);
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

export async function processDocumentForRag(content: string): Promise<RagEmbedding[]> {
  const chunks = splitIntoChunks(content);
  const embeddings: RagEmbedding[] = [];

  for (const chunk of chunks) {
    const vector = await generateEmbedding(chunk);
    embeddings.push({ text: chunk, vector });
  }

  return embeddings;
}

export async function findSimilarChunks(query: string, embeddings: RagEmbedding[], topK: number = 3): Promise<string[]> {
  const queryVector = await generateEmbedding(query);

  // Calculate cosine similarity
  const similarities = embeddings.map(embedding => ({
    text: embedding.text,
    similarity: cosineSimilarity(queryVector, embedding.vector)
  }));

  // Sort by similarity and get top K results
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(result => result.text);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function generateRagResponse(query: string, context: string[]): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Use the provided context to answer questions accurately. If you cannot find the answer in the context, say so."
      },
      {
        role: "user",
        content: `Context:\n${context.join('\n\n')}\n\nQuestion: ${query}`
      }
    ]
  });

  return response.choices[0].message.content || "Failed to generate response";
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
        content: "Suggest data transformations based on the provided data structure. Return array of transformation objects."
      },
      {
        role: "user",
        content: JSON.stringify(data)
      }
    ],
    response_format: { type: "json_object" }
  });

  const responseContent = response.choices[0].message.content;
  if (!responseContent) throw new Error("No response from OpenAI");
  const result = JSON.parse(responseContent);
  return result.transformations || [];
}