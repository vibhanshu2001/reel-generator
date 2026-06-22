import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

export interface GeminiResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

type LLMProvider = 'auto' | 'gemini' | 'deepseek' | 'openai';

interface ModelCandidate {
  provider: 'gemini' | 'deepseek' | 'openai';
  model: string;
  apiKey: string | undefined;
  baseUrl?: string;
}

/**
 * Unified model routing utility supporting both Google Gemini and OpenAI.
 * Automatically detects configured API keys or follows the LLM_PROVIDER env configuration.
 */
export async function generateContentWithRetry(
  apiKey: string,
  modelName: string,
  prompt: string,
  responseSchema?: any,
  maxOutputTokens?: number
): Promise<GeminiResponse> {
  const candidates = buildModelCandidates(apiKey, modelName);
  let lastError: any;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const label = `${candidate.provider}:${candidate.model}`;

    try {
      console.log(`🧠 [LLM] Using ${label}`);

      if (candidate.provider === 'openai') {
        return await generateOpenAIContent(candidate.apiKey || '', candidate.model, prompt, responseSchema, candidate.baseUrl, maxOutputTokens);
      }

      if (candidate.provider === 'deepseek') {
        return await generateDeepSeekContent(candidate.apiKey || '', candidate.model, prompt, responseSchema);
      }

      return await generateGeminiContent(candidate.apiKey || '', candidate.model, prompt, responseSchema, maxOutputTokens);
    } catch (error: any) {
      lastError = error;
      const hasFallback = index < candidates.length - 1;

      if (hasFallback && shouldTryNextModel(error)) {
        console.warn(`⚠️ [LLM] ${label} failed with a fallback-worthy error. Trying next model... Error: ${error.message || error}`);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('LLM request failed before any model candidate was attempted.');
}

function buildModelCandidates(apiKey: string, requestedModel: string): ModelCandidate[] {
  const provider = normalizeProvider(process.env.LLM_PROVIDER);
  const candidates: ModelCandidate[] = [];

  if (provider !== 'openai' && provider !== 'deepseek') {
    const geminiApiKey = process.env.GEMINI_API_KEY || (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY ? apiKey : undefined);
    for (const model of getGeminiModelPreference(requestedModel)) {
      candidates.push({ provider: 'gemini', model, apiKey: geminiApiKey });
    }
  }

  if (provider !== 'gemini' && provider !== 'openai') {
    const deepSeekApiKey = process.env.DEEPSEEK_API_KEY || (provider === 'deepseek' ? apiKey : undefined);
    for (const model of getDeepSeekModelPreference()) {
      candidates.push({ provider: 'deepseek', model, apiKey: deepSeekApiKey });
    }
  }

  if (provider !== 'gemini' || process.env.OPENAI_API_KEY) {
    const openaiApiKey = process.env.OPENAI_API_KEY || (provider === 'openai' ? apiKey : undefined);
    const defaultOpenAIModel = requestedModel.includes('flash') ? 'gpt-4o-mini' : 'gpt-4o';
    const openAIModel = process.env.OPENAI_MODEL || defaultOpenAIModel;
    candidates.push({
      provider: 'openai',
      model: openAIModel,
      apiKey: openaiApiKey,
      baseUrl: process.env.OPENAI_BASE_URL
    });
  }

  return candidates.filter((candidate) => Boolean(candidate.apiKey));
}

function normalizeProvider(provider: string | undefined): LLMProvider {
  const normalized = provider?.trim().toLowerCase();
  return normalized === 'gemini' || normalized === 'deepseek' || normalized === 'openai' ? normalized : 'auto';
}

function getGeminiModelPreference(requestedModel: string): string[] {
  const envModels = process.env.GEMINI_MODELS
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  if (envModels?.length) {
    return dedupe(envModels);
  }

  return dedupe([
    process.env.GEMINI_MODEL,
    requestedModel,
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
  ]);
}

function dedupe(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}

function getDeepSeekModelPreference(): string[] {
  const envModels = process.env.DEEPSEEK_MODELS
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  if (envModels?.length) {
    return dedupe(envModels);
  }

  return dedupe([
    process.env.DEEPSEEK_MODEL,
    'deepseek-v4-flash',
    'deepseek-v4-pro'
  ]);
}

function shouldTryNextModel(error: any): boolean {
  const message = String(error?.message || error || '').toLowerCase();

  return [
    '429',
    'too many requests',
    'rate limit',
    'quota',
    '503',
    '502',
    '500',
    'service unavailable',
    'model not found',
    'not found',
    'permission denied',
    'not supported'
  ].some((fragment) => message.includes(fragment));
}

function getMaxAttempts(): number {
  const configured = Number(process.env.LLM_MODEL_RETRIES);
  return Number.isInteger(configured) && configured > 0 ? configured : 2;
}

/**
 * Makes structured completion requests to the OpenAI Chat API using global Node fetch.
 */
async function generateOpenAIContent(
  apiKey: string,
  modelName: string,
  prompt: string,
  responseSchema?: any,
  baseUrl?: string,
  maxOutputTokens?: number
): Promise<GeminiResponse> {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in backend/.env');
  }

  const url = buildChatCompletionsUrl(baseUrl || 'https://api.openai.com/v1');
  const responseFormatMode = getOpenAIResponseFormatMode(baseUrl);
  
  const body: any = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: responseSchema && responseFormatMode !== 'json_schema'
          ? `${prompt}\n\nReturn only valid JSON that matches the requested structure. Do not include markdown fences or explanatory text.`
          : prompt
      }
    ],
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {})
  };

  // If a responseSchema is provided, instruct OpenAI to adhere strictly to it.
  if (responseSchema && responseFormatMode === 'json_schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response_structure',
        schema: responseSchema
      }
    };
  } else if (responseSchema && responseFormatMode === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  let attempt = 0;
  const maxAttempts = getMaxAttempts();
  let delayMs = 2000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const text = result.choices[0].message.content;
      
      const inputTokens = result.usage?.prompt_tokens ?? 0;
      const outputTokens = result.usage?.completion_tokens ?? 0;

      return {
        text,
        inputTokens,
        outputTokens
      };
    } catch (error: any) {
      const errorMessage = error.message || '';
      const isRetryable = 
        errorMessage.includes('429') || 
        errorMessage.toLowerCase().includes('too many requests') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.includes('503') || 
        errorMessage.includes('502') || 
        errorMessage.includes('500');

      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ [OpenAI] API returned retryable error (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms... Error: ${errorMessage}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        console.error(`❌ [OpenAI] API call failed on attempt ${attempt}:`, errorMessage);
        throw error;
      }
    }
  }

  throw new Error('OpenAI API request failed after maximum retries.');
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  return `${trimmed}/chat/completions`;
}

function getOpenAIResponseFormatMode(baseUrl?: string): 'json_schema' | 'json_object' | 'prompt' {
  const configured = process.env.OPENAI_RESPONSE_FORMAT?.trim().toLowerCase();
  if (configured === 'json_schema' || configured === 'json_object' || configured === 'prompt') {
    return configured;
  }

  const normalizedBaseUrl = baseUrl?.toLowerCase() || '';
  return normalizedBaseUrl && !normalizedBaseUrl.includes('api.openai.com') ? 'json_object' : 'json_schema';
}

/**
 * Makes chat completion requests to DeepSeek's OpenAI-compatible API.
 */
async function generateDeepSeekContent(
  apiKey: string,
  modelName: string,
  prompt: string,
  responseSchema?: any
): Promise<GeminiResponse> {
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured in backend/.env');
  }

  const url = `${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`;
  const body: any = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: responseSchema
          ? `${prompt}\n\nReturn only valid JSON that matches the requested structure. Do not include markdown fences or explanatory text.`
          : prompt
      }
    ],
    stream: false
  };

  if (responseSchema) {
    body.response_format = { type: 'json_object' };
  }

  return generateOpenAICompatibleContent('DeepSeek', url, apiKey, body);
}

/**
 * Makes structured completion requests to the Google Gemini API.
 */
async function generateGeminiContent(
  apiKey: string,
  modelName: string,
  prompt: string,
  responseSchema?: any,
  maxOutputTokens?: number
): Promise<GeminiResponse> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const generationConfig: any = responseSchema 
    ? { responseMimeType: 'application/json', responseSchema } 
    : {};
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
    
  const model = genAI.getGenerativeModel({ model: modelName, generationConfig: Object.keys(generationConfig).length ? generationConfig : undefined });
  
  let attempt = 0;
  const maxAttempts = getMaxAttempts();
  let delayMs = 2000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const usage = result.response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;

      return {
        text,
        inputTokens,
        outputTokens
      };
    } catch (error: any) {
      const errorMessage = error.message || '';
      const is503 = errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable');
      const is429 = errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests');
      
      const isRetryable = is503 || is429;

      if (isRetryable && attempt < maxAttempts) {
        console.warn(`⚠️ [Gemini] API returned retryable error (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms... Error: ${errorMessage}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        console.error(`❌ [Gemini] API call failed on attempt ${attempt}:`, errorMessage);
        throw error;
      }
    }
  }
  
  throw new Error('Gemini API request failed after maximum retries.');
}

async function generateOpenAICompatibleContent(
  providerName: string,
  url: string,
  apiKey: string,
  body: any
): Promise<GeminiResponse> {
  let attempt = 0;
  const maxAttempts = getMaxAttempts();
  let delayMs = 2000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${providerName} API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const text = result.choices[0].message.content;

      return {
        text,
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0
      };
    } catch (error: any) {
      const errorMessage = error.message || '';

      if (shouldTryNextModel(error) && attempt < maxAttempts) {
        console.warn(`⚠️ [${providerName}] API returned retryable error (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms... Error: ${errorMessage}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        console.error(`❌ [${providerName}] API call failed on attempt ${attempt}:`, errorMessage);
        throw error;
      }
    }
  }

  throw new Error(`${providerName} API request failed after maximum retries.`);
}
