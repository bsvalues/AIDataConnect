import { type ChatPostMessageArguments, WebClient } from "@slack/web-api";
import logger from "./logger";

// Store slack client at module level but initialize it lazily
let slack: WebClient | null = null;

/**
 * Initialize the Slack client if credentials are available
 * @returns boolean indicating if initialization was successful
 */
function initializeSlack(): boolean {
  if (slack) return true;

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
    logger.warn("Slack notifications disabled: missing credentials");
    return false;
  }

  try {
    slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    return true;
  } catch (error) {
    logger.error("Failed to initialize Slack client", { error });
    return false;
  }
}

/**
 * Sends an error notification to Slack
 * @param error - Error object or message to send
 * @param metadata - Additional context about the error
 */
export async function sendErrorNotification(
  error: Error | string,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!initializeSlack()) return;

  try {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 Error Alert",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Message:*\n\`\`\`${errorMessage}\`\`\``
        }
      }
    ];

    // Add stack trace if available
    if (errorStack) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Stack Trace:*\n\`\`\`${errorStack.split('\n').slice(0, 5).join('\n')}\`\`\``
        }
      });
    }

    // Add metadata if available
    if (Object.keys(metadata).length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Additional Context:*\n\`\`\`${JSON.stringify(metadata, null, 2)}\`\`\``
        }
      });
    }

    // Add timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Time:* ${new Date().toISOString()}`
        }
      ]
    });

    const message: ChatPostMessageArguments = {
      channel: process.env.SLACK_CHANNEL_ID!,
      blocks,
      text: `Error Alert: ${errorMessage}`, // Fallback text
    };

    await slack!.chat.postMessage(message);
    logger.debug("Error notification sent to Slack successfully");
  } catch (slackError) {
    logger.error("Failed to send error notification to Slack", {
      error: slackError,
      originalError: error
    });
  }
}