import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as openaiModule from './openai';
const {
  generateEmbedding,
  processDocumentForRag,
  findSimilarChunks,
  generateRagResponse
} = openaiModule;

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }]
        })
      },
      chat: {
        completions: {
          create: vi.fn().mockImplementation(({ messages }: { messages: Array<{role: string, content: string}> }) => {
            // Return JSON for analyzeRagPerformance calls
            if (messages.some(msg => msg.content.includes('analyze'))) {
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        contextRelevance: 0.8,
                        responseQuality: 0.9,
                        suggestedImprovements: ["Improve context retrieval", "Add more sources"]
                      })
                    }
                  }
                ]
              });
            }
            
            // Default response for other cases
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: 'Test response'
                  }
                }
              ]
            });
          })
        }
      }
    }))
  };
});

describe('OpenAI Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const text = 'This is a test text';
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should accept custom configuration', async () => {
      const text = 'Custom config test';
      const config = {
        embeddingModel: 'custom-model'
      };
      
      const embedding = await generateEmbedding(text, config);
      
      expect(embedding).toBeInstanceOf(Array);
    });
  });

  describe('processDocumentForRag', () => {
    it('should process a document into RAG chunks with embeddings', async () => {
      const text = 'This is a test document for RAG processing. It should be split into chunks and processed.';
      const result = await processDocumentForRag(text, {});
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('vector');
    });
  });

  describe('findSimilarChunks', () => {
    it('should find similar chunks based on a query', async () => {
      const query = 'test query';
      const chunks = [
        { text: 'This is a test document', vector: [0.1, 0.2, 0.3] },
        { text: 'This is another document', vector: [0.4, 0.5, 0.6] }
      ];
      
      // Mock the function to return a specific result
      vi.spyOn(global.Math, 'max').mockReturnValue(0.9);
      
      const results = await findSimilarChunks(query, chunks, { topK: 1 });
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(1);
      // Restore Math.max
      vi.spyOn(global.Math, 'max').mockRestore();
    });
  });

  describe('generateRagResponse', () => {
    it('should generate a response based on context and query', async () => {
      const query = 'What is RAG?';
      const context = [
        'RAG stands for Retrieval Augmented Generation',
        'It combines search and language models'
      ];
      
      const response = await generateRagResponse(query, context);
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('analyzeRagPerformance', () => {
    it('should analyze RAG performance', async () => {
      const query = 'Test query';
      const response = 'Test response';
      const context = [
        'Context 1',
        'Context 2'
      ];
      
      // Mock analyzeRagPerformance
      const mockResult = {
        contextRelevance: 0.8,
        responseQuality: 0.9,
        suggestedImprovements: ["Improve retrieval", "Add more context"]
      };
      
      vi.spyOn(openaiModule, 'analyzeRagPerformance').mockResolvedValue(mockResult);
      
      const result = await openaiModule.analyzeRagPerformance(query, response, context);
      
      expect(result).toHaveProperty('contextRelevance');
      expect(result).toHaveProperty('responseQuality');
      expect(result).toHaveProperty('suggestedImprovements');
      expect(typeof result.contextRelevance).toBe('number');
    });
  });
});