import { GoogleGenAI } from '@google/genai';
import { logger } from '../middleware/googleCloudLogger.js';

// Initialize the Google Gen AI SDK
const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;

let ai = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  logger.warn('⚠️ No LLM_API_KEY found. LLM calls will fail unless provided.');
}

/**
 * Generate a response using Gemini model.
 * @param {string} prompt - The text prompt
 * @param {string} systemInstruction - The system instruction
 * @param {boolean} jsonMode - Whether to force JSON output
 * @returns {Promise<string>} The response text
 */
export async function generateContent(prompt, systemInstruction = '', jsonMode = false) {
  if (!ai) {
    throw new Error('LLM_API_KEY is not configured.');
  }

  const config = {
    systemInstruction,
    temperature: 0.2,
  };

  if (jsonMode) {
    config.responseMimeType = 'application/json';
  }

  let retries = 3;
  let backoff = 1000;

  while (retries > 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config,
      });
      return response.text;
    } catch (err) {
      retries--;
      // Check if error is retryable (rate limit or server error)
      const isRetryable = err?.status === 429 || err?.status >= 500 || err?.message?.includes('fetch failed');
      
      if (retries === 0 || !isRetryable) {
        logger.error('LLM Generation Error:', err);
        throw err;
      }
      
      logger.warn(`⚠️ LLM API Error (Retrying in ${backoff}ms): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2; // Exponential backoff
    }
  }
}

/**
 * Generate a response using Gemini Vision model.
 * @param {string} prompt - The text prompt
 * @param {string} base64Image - The base64 encoded image string (with or without data URI prefix)
 * @param {string} systemInstruction - The system instruction
 * @returns {Promise<string>} The response text (JSON string)
 */
export async function generateVisionContent(prompt, base64Image, systemInstruction = '') {
  if (!ai) {
    throw new Error('LLM_API_KEY is not configured.');
  }

  // Strip prefix if present (e.g., "data:image/jpeg;base64,")
  let cleanBase64 = base64Image;
  let mimeType = 'image/jpeg';
  if (base64Image.startsWith('data:')) {
    const parts = base64Image.split(';');
    mimeType = parts[0].split(':')[1];
    cleanBase64 = parts[1].replace('base64,', '');
  }

  const config = {
    systemInstruction,
    temperature: 0.1,
    responseMimeType: 'application/json',
  };

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType
          }
        }
      ]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: contents,
      config,
    });
    return response.text;
  } catch (err) {
    logger.error('LLM Vision Error:', err);
    throw err;
  }
}

/**
 * Robustly parses JSON from LLM output, handling potential markdown code blocks.
 * @param {string} text - The raw text from the LLM
 * @returns {object} The parsed JSON object
 * @throws {Error} If parsing fails
 */
export function parseLlmJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input to parseLlmJson: not a string');
  }
  // Strip markdown code blocks if present
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}
