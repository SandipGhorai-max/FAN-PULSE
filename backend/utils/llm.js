import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI SDK
const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;

let ai = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn('⚠️ No LLM_API_KEY found. LLM calls will fail unless provided.');
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config,
    });
    return response.text;
  } catch (err) {
    console.error('LLM Generation Error:', err);
    throw err;
  }
}
