import { describe, it, expect, vi } from 'vitest';
import { configureHelmet, configureCors, configureChatRateLimit, configureGeneralRateLimit, ALLOWED_ORIGINS } from '../middleware/security.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { AgentError, handleAgentError, withErrorHandling } from '../utils/errorWrapper.js';

describe('Security Middleware', () => {
  it('should return helmet configuration', () => {
    const helmetMiddleware = configureHelmet();
    expect(typeof helmetMiddleware).toBe('function');
  });

  it('should return cors configuration with allowed origins', () => {
    const corsMiddleware = configureCors();
    expect(typeof corsMiddleware).toBe('function');
    expect(ALLOWED_ORIGINS.length).toBeGreaterThan(0);
  });

  it('should return rate limiters', () => {
    expect(typeof configureChatRateLimit()).toBe('function');
    expect(typeof configureGeneralRateLimit()).toBe('function');
  });
});

describe('Error Handler Middleware', () => {
  it('should handle AgentError and set status code', () => {
    const err = new AgentError('Test error', 'TEST_CODE', 400);
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();
    
    globalErrorHandler(err, {}, res, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: true,
      message: 'Test error',
      code: 'TEST_CODE'
    });
  });

  it('should handle standard Error and set 500 status code', () => {
    const err = new Error('Standard error');
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    
    globalErrorHandler(err, {}, res, vi.fn());
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: true,
      message: 'An unexpected error occurred while processing your request.'
    }));
  });
});

describe('Error Wrapper Utils', () => {
  it('handleAgentError should format AgentError correctly', () => {
    const err = new AgentError('msg', 'CODE', 404);
    const result = handleAgentError(err, 'TestAgent');
    expect(result).toEqual({
      status: 'error',
      code: 'CODE',
      message: 'msg',
      agent: 'TestAgent'
    });
  });

  it('handleAgentError should format generic Error correctly', () => {
    const err = new Error('generic');
    const result = handleAgentError(err, 'TestAgent');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.agent).toBe('TestAgent');
  });

  it('withErrorHandling should catch errors and return handled object', async () => {
    const thrower = async () => { throw new Error('fail'); };
    const wrapped = withErrorHandling('Agent', thrower);
    
    const result = await wrapped();
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.agent).toBe('Agent');
  });

  it('withErrorHandling should return result if no error', async () => {
    const worker = async () => 'success';
    const wrapped = withErrorHandling('Agent', worker);
    
    const result = await wrapped();
    expect(result).toBe('success');
  });
});

import { sanitizeText } from '../middleware/validation.js';

describe('Validation Utils', () => {
  it('sanitizeText should clean input strings', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(123)).toBe('');
    expect(sanitizeText('  hello  \n world  ')).toBe('hello world');
    // Testing control characters strip (e.g. \x0B vertical tab)
    expect(sanitizeText('hello\x0Bworld')).toBe('helloworld');
    // Testing length limit
    const longString = 'a'.repeat(3000);
    expect(sanitizeText(longString).length).toBe(2000);
  });
});
