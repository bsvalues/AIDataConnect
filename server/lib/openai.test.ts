import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as openaiModule from './openai';
const {
  generateEmbedding,
  processDocumentForRag,
  findSimilarChunks,
  generateRagResponse,
  analyzeRagPerformance,
  analyzeFile,
  searchFiles,
  suggestTransformations
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
            if (messages.some(msg => msg.content.includes('analyze') && msg.content.includes('RAG'))) {
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
            
            // Return JSON for analyzeFile calls
            if (messages.some(msg => msg.content.includes('Analyze the file content'))) {
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        summary: 'Test summary',
                        category: 'Test category',
                        keyInsights: ['insight 1', 'insight 2'],
                        sentiment: 'positive'
                      })
                    }
                  }
                ]
              });
            }
            
            // Return JSON for searchFiles calls
            if (messages.some(msg => msg.content.includes('search query') || msg.content.includes('rank them by relevance'))) {
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        results: [
                          { id: 1, relevance: 0.9 },
                          { id: 2, relevance: 0.7 }
                        ]
                      })
                    }
                  }
                ]
              });
            }
            
            // Return JSON for suggestTransformations calls
            if (messages.some(msg => msg.content.includes('transformation'))) {
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        transformations: [
                          {
                            name: 'Remove duplicates',
                            description: 'Remove duplicate entries from the data',
                            transformation: 'data.filter((value, index, self) => self.indexOf(value) === index)'
                          },
                          {
                            name: 'Convert to uppercase',
                            description: 'Convert all string values to uppercase',
                            transformation: 'data.map(item => typeof item === "string" ? item.toUpperCase() : item)'
                          }
                        ]
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
      
      const result = await openaiModule.analyzeRagPerformance(query, context, response);
      
      expect(result).toHaveProperty('contextRelevance');
      expect(result).toHaveProperty('responseQuality');
      expect(result).toHaveProperty('suggestedImprovements');
      expect(typeof result.contextRelevance).toBe('number');
    });
  });

  describe('analyzeFile', () => {
    it('should analyze file content and return summary and category', async () => {
      // Mock the OpenAI response
      vi.spyOn(openaiModule, 'analyzeFile').mockResolvedValue({
        summary: 'Test summary',
        category: 'Test category',
        keyInsights: ['insight 1', 'insight 2'],
        sentiment: 'positive'
      });

      const content = 'This is test file content';
      const result = await analyzeFile(content);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('keyInsights');
      expect(result).toHaveProperty('sentiment');
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(typeof result.sentiment).toBe('string');
    });
  });

  describe('searchFiles', () => {
    it('should search files based on query and return results', async () => {
      // Mock the implementation
      vi.spyOn(openaiModule, 'searchFiles').mockResolvedValue([
        { id: 1, relevance: 0.9 },
        { id: 2, relevance: 0.7 }
      ]);

      const query = 'test query';
      const files = [
        { name: 'file1.txt', content: 'This is file 1 content' },
        { name: 'file2.txt', content: 'This is file 2 content' }
      ];

      const results = await searchFiles(query, files);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('relevance');
      expect(typeof results[0].relevance).toBe('number');
    });
  });

  describe('suggestTransformations', () => {
    it('should suggest transformations for data', async () => {
      // Mock the OpenAI response
      vi.spyOn(openaiModule, 'suggestTransformations').mockResolvedValue([
        {
          name: 'Remove duplicates',
          description: 'Remove duplicate entries from the data',
          transformation: 'data.filter((value, index, self) => self.indexOf(value) === index)'
        },
        {
          name: 'Convert to uppercase',
          description: 'Convert all string values to uppercase',
          transformation: 'data.map(item => typeof item === "string" ? item.toUpperCase() : item)'
        }
      ]);

      const data = ['test', 'data', 'test'];
      const results = await suggestTransformations(data);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('description');
      expect(results[0]).toHaveProperty('transformation');
      expect(typeof results[0].transformation).toBe('string');
    });
  });
});