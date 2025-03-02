import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendErrorNotification } from './slack';
import logger from './logger';

// Mock postMessage function
const mockPostMessage = vi.fn().mockResolvedValue({ ok: true });

// Simple mocks that focus just on what we need to test
vi.mock('@slack/web-api', () => ({
  WebClient: class MockWebClient {
    chat = {
      postMessage: mockPostMessage
    };
    
    constructor() {
      // Intentionally left empty
    }
  }
}));

// Mock logger
vi.mock('./logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Slack Integration', () => {
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    process.env = { ...originalEnv };
  });
  
  describe('sendErrorNotification', () => {
    it('should log a warning if Slack credentials are missing', async () => {
      // Clear the environment variables
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_CHANNEL_ID;
      
      await sendErrorNotification('Test error');
      
      expect(logger.warn).toHaveBeenCalledWith('Slack notifications disabled: missing credentials');
    });
    
    it('should attempt to send notification with valid credentials', async () => {
      // Set the environment variables
      process.env.SLACK_BOT_TOKEN = 'test-token';
      process.env.SLACK_CHANNEL_ID = 'test-channel';
      
      await sendErrorNotification('Test error message');
      
      // Successfully initialized Slack
      expect(logger.debug).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalled();
    });
    
    it('should include additional metadata in the message', async () => {
      // Set the environment variables
      process.env.SLACK_BOT_TOKEN = 'test-token';
      process.env.SLACK_CHANNEL_ID = 'test-channel';
      
      const metadata = { userId: '123', action: 'test-action' };
      await sendErrorNotification('Test error with metadata', metadata);
      
      expect(mockPostMessage).toHaveBeenCalled();
      
      // Check if the metadata was included in the message
      const callArgs = mockPostMessage.mock.calls[0][0];
      
      // Verify that blocks exists and is an array
      expect(Array.isArray(callArgs.blocks)).toBe(true);
      
      // Check if any block contains our metadata
      const metadataIncluded = callArgs.blocks.some((block: any) => {
        return block.text && 
               block.text.text && 
               block.text.text.includes('Additional Context') &&
               block.text.text.includes('userId') &&
               block.text.text.includes('test-action');
      });
      
      expect(metadataIncluded).toBe(true);
    });
  });
});