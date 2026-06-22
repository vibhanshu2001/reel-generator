import { generateContentWithRetry } from '../gemini.js';

export interface ResearchResult {
  outline: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runResearch(topic: string, apiKey: string): Promise<ResearchResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are an expert technical researcher. Return a tight bullet-point outline for: "${topic}".
Be concise — max 150 words total. Cover:
• Core problem + main benefit (1-2 bullets)
• How it works: key components / data flow (2-3 bullets)
• Minimal code snippet or CLI command (inline, 3-6 lines max)
• One key comparison vs the main alternative (1-2 bullets)

No fluff, no prose paragraphs. Bullets only.`;

  const geminiResponse = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt);

  return {
    outline: geminiResponse.text,
    inputTokens: geminiResponse.inputTokens,
    outputTokens: geminiResponse.outputTokens
  };
}
