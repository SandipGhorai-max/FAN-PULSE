import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as googleGenAi from '@google/genai';
import { generateContent } from '../utils/llm.js';

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: vi.fn()
        }
      };
    })
  };
});

describe('LLM Utility', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.LLM_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate content successfully on first try', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({ text: 'Success response' });
    
    // We need to override the instance created in llm.js
    // Since llm.js runs once, we can just spy on the methods if we can reach them,
    // but the file creates `ai` internally. 
    // Wait, since we mocked GoogleGenAI before import, it should use our mock.
    const { GoogleGenAI } = await import('@google/genai');
    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerateContent }
    }));

    // Re-import to trigger initialization with the new mock
    const llmModule = await import('../utils/llm.js?update=1');

    const result = await llmModule.generateContent('Hello', 'System Instruction', false);
    
    expect(result).toBe('Success response');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    }));
  });

  it('should retry on 429 error and succeed', async () => {
    const error429 = new Error('Rate limit');
    error429.status = 429;
    
    const mockGenerateContent = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({ text: 'Success after retry' });
      
    const { GoogleGenAI } = await import('@google/genai');
    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerateContent }
    }));

    const llmModule = await import('../utils/llm.js?update=2');
    
    const result = await llmModule.generateContent('Retry test');
    expect(result).toBe('Success after retry');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('should throw immediately on 400 error (non-retryable)', async () => {
    const error400 = new Error('Bad request');
    error400.status = 400;
    
    const mockGenerateContent = vi.fn().mockRejectedValue(error400);
      
    const { GoogleGenAI } = await import('@google/genai');
    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerateContent }
    }));

    const llmModule = await import('../utils/llm.js?update=3');
    
    await expect(llmModule.generateContent('Fail test')).rejects.toThrow('Bad request');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should generate vision content', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({ text: '{"success":true}' });
    const { GoogleGenAI } = await import('@google/genai');
    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerateContent }
    }));
    const llmModule = await import('../utils/llm.js?update=4');

    const result = await llmModule.generateVisionContent('scan', 'data:image/jpeg;base64,123');
    expect(result).toBe('{"success":true}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-1.5-flash'
    }));

    // test without prefix
    await llmModule.generateVisionContent('scan', '123');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
