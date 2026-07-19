import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateResponse, handlePolyglotRequest, getRecentAnnouncements } from '../agents/polyglotConcierge.js';
import * as llm from '../utils/llm.js';
import { getDb, resetDb } from '../db/schema.js';

// Mock generateContent
vi.mock('../utils/llm.js', () => ({
  generateContent: vi.fn(),
}));

describe('Polyglot Concierge — translateResponse', () => {
  it('translates with Spanish greeting prefix', () => {
    const result = translateResponse('Welcome to the stadium', 'es');
    expect(result).toContain('¡Hola!');
    expect(result).toContain('[ES]');
  });

  it('translates with French greeting prefix', () => {
    const result = translateResponse('Welcome to the stadium', 'fr');
    expect(result).toContain('Bonjour');
    expect(result).toContain('[FR]');
  });

  it('translates with Korean greeting prefix', () => {
    const result = translateResponse('Welcome to the stadium', 'ko');
    expect(result).toContain('안녕하세요');
    expect(result).toContain('[KO]');
  });

  it('translates with Arabic greeting prefix', () => {
    const result = translateResponse('Welcome to the stadium', 'ar');
    expect(result).toContain('مرحبًا');
    expect(result).toContain('[AR]');
  });

  it('handles unknown language gracefully', () => {
    const result = translateResponse('Hello', 'de');
    expect(result).toBe('[DE] Hello');
  });
});

describe('Polyglot Concierge — handlePolyglotRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
    const db = getDb();
    db.prepare(`INSERT INTO zones (id, name, type, capacity) VALUES ('gate-a', 'Gate A', 'gate', 500)`).run();
  });

  it('returns recent announcements for action=recent', async () => {
    const result = await handlePolyglotRequest({ action: 'recent' });
    expect(result.announcements).toBeDefined();
    expect(Array.isArray(result.announcements)).toBe(true);
  });

  it('returns template keys for action=templates', async () => {
    const result = await handlePolyglotRequest({ action: 'templates' });
    expect(result.templates).toBeDefined();
    expect(result.templates).toContain('welcome');
    expect(result.templates).toContain('halftime');
    expect(result.templates).toContain('emergency_evacuation');
    expect(result.templates).toContain('crowd_redirect');
    expect(result.templates).toContain('gate_closure');
    expect(result.templates).toContain('security_reminder');
  });

  it('falls back to recent for unknown action', async () => {
    const result = await handlePolyglotRequest({ action: 'unknown_action' });
    expect(result.announcements).toBeDefined();
  });

  it('generates PA announcement from template', async () => {
    // Mock LLM for translation
    llm.generateContent.mockResolvedValueOnce(JSON.stringify({
      es: 'Bienvenidos al Mundial 2026!',
      fr: 'Bienvenue à la Coupe du Monde 2026!',
      ko: '2026 월드컵에 오신 것을 환영합니다!',
      ar: 'مرحبا بكم في كأس العالم 2026!'
    }));

    const result = await handlePolyglotRequest({
      action: 'announce',
      template: 'welcome',
      vars: {},
      priority: 'normal',
    });
    
    expect(result.announcement).toBeDefined();
    expect(result.announcement.message_en).toContain('Welcome to the FIFA World Cup 2026');
    expect(result.announcement.priority).toBe('normal');
    expect(result.announcement.id).toBeDefined();
  });

  it('generates custom PA announcement without template', async () => {
    llm.generateContent.mockResolvedValueOnce(JSON.stringify({
      es: 'Prueba de anuncio',
      fr: 'Annonce de test',
      ko: '테스트 안내',
      ar: 'إعلان تجريبي'
    }));

    const result = await handlePolyglotRequest({
      action: 'announce',
      message: 'Test announcement please',
      priority: 'high',
    });
    
    expect(result.announcement).toBeDefined();
    expect(result.announcement.message_en).toBe('Test announcement please');
    expect(result.announcement.priority).toBe('high');
  });

  it('generates PA announcement with template variables', async () => {
    llm.generateContent.mockResolvedValueOnce(JSON.stringify({
      es: 'Puerta A está cerrada',
      fr: 'Porte A est fermée',
      ko: '게이트 A가 폐쇄되었습니다',
      ar: 'البوابة أ مغلقة'
    }));

    const result = await handlePolyglotRequest({
      action: 'announce',
      template: 'gate_closure',
      vars: { gate: 'Gate A', altGate: 'Gate B' },
      zoneId: 'gate-a',
      priority: 'urgent',
    });
    
    expect(result.announcement.message_en).toContain('Gate A');
    expect(result.announcement.message_en).toContain('Gate B');
    expect(result.announcement.zone_id).toBe('gate-a');
  });

  it('handles LLM translation failure gracefully (fallback prefixes)', async () => {
    llm.generateContent.mockRejectedValueOnce(new Error('Translation API down'));

    const result = await handlePolyglotRequest({
      action: 'announce',
      message: 'Attention please',
      priority: 'normal',
    });
    
    // Should still return an announcement with fallback translations
    expect(result.announcement.message_en).toBe('Attention please');
    expect(result.announcement.message_es).toContain('[ES]');
    expect(result.announcement.message_fr).toContain('[FR]');
  });
});

describe('Polyglot Concierge — getRecentAnnouncements', () => {
  it('returns an array of announcements', () => {
    const results = getRecentAnnouncements(5);
    expect(Array.isArray(results)).toBe(true);
  });

  it('respects the limit parameter', () => {
    const results = getRecentAnnouncements(1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
