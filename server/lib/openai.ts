import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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