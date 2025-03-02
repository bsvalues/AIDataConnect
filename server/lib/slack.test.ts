import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendErrorNotification } from './slack';
import logger from './logger';

// Create a mock for WebClient's chat.postMessage
const mockPostMessage = vi.fn().mockResolvedValue({ ok: true });

// Mock @slack/web-api
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: mockPostMessage
    }
  }))
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
    vi.resetModules();
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
      // The WebClient constructor should not have been called
      expect(require('@slack/web-api').WebClient).not.toHaveBeenCalled();
    });
    
    it('should log errors during sending', async () => {
      // Setup environment
      process.env.SLACK_BOT_TOKEN = 'test-token';
      process.env.SLACK_CHANNEL_ID = 'test-channel';
      
      // Mock postMessage to throw an error
      mockPostMessage.mockRejectedValueOnce(new Error('Slack API error'));
      
      await sendErrorNotification('Test error');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send error notification to Slack',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });
  });
});