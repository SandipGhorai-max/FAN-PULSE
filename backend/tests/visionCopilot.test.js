import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanTicket } from '../agents/visionCopilot.js';
import * as llm from '../utils/llm.js';

vi.mock('../utils/llm.js', () => ({
  generateVisionContent: vi.fn(),
  parseLlmJson: vi.fn(),
}));

describe('Vision Copilot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scanTicket should return extracted data on success', async () => {
    const mockData = {
      section: '105',
      row: 'G',
      seat: '10',
      nearestGate: 'Gate B',
      ticketHolderType: 'General',
      confidenceScore: 0.98
    };

    llm.generateVisionContent.mockResolvedValueOnce('JSON_STRING');
    llm.parseLlmJson.mockReturnValueOnce(mockData);

    const result = await scanTicket('data:image/png;base64,dummy');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(llm.generateVisionContent).toHaveBeenCalledTimes(1);
    expect(llm.parseLlmJson).toHaveBeenCalledWith('JSON_STRING');
  });

  it('scanTicket should fallback to mock data on error', async () => {
    llm.generateVisionContent.mockRejectedValueOnce(new Error('Vision LLM failed'));

    const result = await scanTicket('data:image/png;base64,dummy');
    
    expect(result.success).toBe(true);
    expect(result.data.section).toBe('102');
    expect(result.data.nearestGate).toBe('Gate A');
  });
});
