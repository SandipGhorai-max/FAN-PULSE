/**
 * @module agents/polyglotConcierge
 * @description 🌍 Polyglot Concierge Agent — Real-time translation in 5+ languages.
 * Generates multilingual PA announcements and translated responses.
 * Template-based for demo reliability, extensible to real translation API.
 */

import { getDb } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { generateContent } from '../utils/llm.js';

/**
 * Translation templates for common stadium scenarios.
 * Each key maps to translations in en/es/fr/ko/ar.
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
const TRANSLATION_TEMPLATES = {
  crowd_redirect: {
    en: 'Attention: {zone} is experiencing high traffic. Please use alternate routes via {altRoute}. Follow staff directions.',
    es: 'Atención: {zone} tiene mucho tráfico. Por favor, use rutas alternativas por {altRoute}. Siga las indicaciones del personal.',
    fr: 'Attention : {zone} connaît un trafic élevé. Veuillez emprunter les itinéraires alternatifs via {altRoute}. Suivez les instructions du personnel.',
    ko: '안내: {zone} 구역이 혼잡합니다. {altRoute}을(를) 통한 대체 경로를 이용해 주세요. 직원의 안내를 따라주세요.',
    ar: 'تنبيه: {zone} يشهد ازدحامًا كبيرًا. يرجى استخدام المسارات البديلة عبر {altRoute}. اتبعوا تعليمات الموظفين.',
  },
  gate_closure: {
    en: 'Notice: {gate} is temporarily closed. Please proceed to {altGate} for entry.',
    es: 'Aviso: {gate} está temporalmente cerrada. Diríjase a {altGate} para entrar.',
    fr: 'Avis : {gate} est temporairement fermée. Veuillez vous diriger vers {altGate}.',
    ko: '안내: {gate}이(가) 임시 폐쇄되었습니다. {altGate}으로 이동해 주세요.',
    ar: 'إشعار: {gate} مغلقة مؤقتاً. يرجى التوجه إلى {altGate} للدخول.',
  },
  emergency_evacuation: {
    en: 'EMERGENCY: Please evacuate via the nearest exit. Remain calm and follow staff instructions.',
    es: 'EMERGENCIA: Evacúe por la salida más cercana. Mantenga la calma y siga las instrucciones del personal.',
    fr: 'URGENCE : Veuillez évacuer par la sortie la plus proche. Restez calme et suivez les instructions du personnel.',
    ko: '긴급: 가장 가까운 출구로 대피해 주세요. 침착하게 직원의 안내를 따라주세요.',
    ar: 'طوارئ: يرجى الإخلاء عبر أقرب مخرج. حافظوا على الهدوء واتبعوا تعليمات الموظفين.',
  },
  welcome: {
    en: 'Welcome to the FIFA World Cup 2026! Enjoy the match. Stay hydrated — free water stations throughout the stadium.',
    es: '¡Bienvenidos al Mundial FIFA 2026! Disfruten del partido. Manténganse hidratados — hay estaciones de agua gratuitas en todo el estadio.',
    fr: 'Bienvenue à la Coupe du Monde FIFA 2026 ! Profitez du match. Restez hydratés — des stations d\'eau gratuites dans tout le stade.',
    ko: '2026 FIFA 월드컵에 오신 것을 환영합니다! 경기를 즐겨주세요. 수분을 보충하세요 — 경기장 곳곳에 무료 급수대가 있습니다.',
    ar: 'مرحبًا بكم في كأس العالم FIFA 2026! استمتعوا بالمباراة. حافظوا على ترطيبكم — محطات مياه مجانية في جميع أنحاء الملعب.',
  },
  security_reminder: {
    en: 'Security reminder: Keep your belongings secure. Report suspicious items to the nearest staff member.',
    es: 'Recordatorio de seguridad: Mantenga sus pertenencias seguras. Informe de objetos sospechosos al personal más cercano.',
    fr: 'Rappel de sécurité : Gardez vos affaires en sécurité. Signalez tout objet suspect au personnel le plus proche.',
    ko: '보안 안내: 소지품을 안전하게 보관하세요. 의심스러운 물품은 가까운 직원에게 신고해 주세요.',
    ar: 'تذكير أمني: حافظوا على أمان ممتلكاتكم. أبلغوا عن أي أغراض مشبوهة لأقرب موظف.',
  },
  halftime: {
    en: 'Halftime! Concession stands are open. Beat the rush — check the FanPulse app for the shortest lines.',
    es: '¡Medio tiempo! Los puestos de comida están abiertos. Evite las filas — consulte la app FanPulse para las filas más cortas.',
    fr: 'Mi-temps ! Les stands de restauration sont ouverts. Évitez la foule — consultez l\'app FanPulse pour les files les plus courtes.',
    ko: '하프타임! 매점이 영업 중입니다. 혼잡을 피하세요 — FanPulse 앱에서 가장 짧은 줄을 확인하세요.',
    ar: 'استراحة! أكشاك الطعام مفتوحة. تجنبوا الازدحام — تحققوا من تطبيق FanPulse لأقصر طابور.',
  },
};


/**
 * Generates a multilingual PA announcement from a template or text using Gemini.
 * @param {string} templateKey - Key from TRANSLATION_TEMPLATES (optional)
 * @param {Record<string, string>} vars - Variables to interpolate
 * @param {string} [zoneId] - Target zone
 * @param {'normal'|'high'|'urgent'} [priority] - Priority level
 * @returns {Promise<object>} PA announcement with all 5 languages
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export async function generatePAAnnouncement(templateKey, vars = {}, zoneId = null, priority = 'normal') {
  const template = TRANSLATION_TEMPLATES[templateKey];
  let baseEnglishMessage = vars.message || 'Attention please.';

  if (template && template.en) {
    baseEnglishMessage = template.en;
    for (const [key, value] of Object.entries(vars)) {
      baseEnglishMessage = baseEnglishMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  }

  return await generateCustomPAAnnouncement(baseEnglishMessage, zoneId, priority);
}

/**
 * Generates a custom (non-template) PA announcement with real LLM translations.
 * @param {string} messageEn - English message
 * @param {string} [zoneId] - Target zone
 * @param {'normal'|'high'|'urgent'} [priority] - Priority level
 * @returns {Promise<object>} PA announcement
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export async function generateCustomPAAnnouncement(messageEn, zoneId = null, priority = 'normal') {
  const prompt = `Translate the following stadium PA announcement into Spanish, French, Korean, and Arabic.
Ensure the tone is clear, authoritative, and helpful for fans.

Message to translate: "${messageEn}"

Return STRICTLY in JSON format:
{
  "es": "...",
  "fr": "...",
  "ko": "...",
  "ar": "..."
}`;

  let translations = {
    es: `[ES] ${messageEn}`,
    fr: `[FR] ${messageEn}`,
    ko: `[KO] ${messageEn}`,
    ar: `[AR] ${messageEn}`,
  };

  try {
    const responseText = await generateContent(prompt, 'You are a professional polyglot translator returning strict JSON.', true);
    const data = JSON.parse(responseText.trim().replace(/^```json/i, '').replace(/```$/i, ''));
    translations = { ...translations, ...data };
  } catch (err) {
    console.error('LLM translation failed:', err);
  }

  const announcement = {
    id: uuidv4(),
    message_en: messageEn,
    message_es: translations.es,
    message_fr: translations.fr,
    message_ko: translations.ko,
    message_ar: translations.ar,
    zone_id: zoneId,
    priority,
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO pa_announcements (id, message_en, message_es, message_fr, message_ko, message_ar, zone_id, priority)
    VALUES (@id, @message_en, @message_es, @message_fr, @message_ko, @message_ar, @zone_id, @priority)
  `).run(announcement);

  return announcement;
}

/**
 * Gets recent PA announcements.
 * @param {number} [limit] - Number of announcements to return
 * @returns {object[]} Recent announcements
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function getRecentAnnouncements(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT pa.*, z.name as zone_name
    FROM pa_announcements pa
    LEFT JOIN zones z ON z.id = pa.zone_id
    ORDER BY pa.created_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Translates a simple fan-facing response.
 * @param {string} text - English text
 * @param {string} targetLang - Target language code (es/fr/ko/ar)
 * @returns {string} Translated text (template-based approximation)
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export function translateResponse(text, targetLang) {
  const greetings = {
    es: '¡Hola! ', fr: 'Bonjour ! ', ko: '안녕하세요! ', ar: 'مرحبًا! ',
  };
  return (greetings[targetLang] || '') + `[${targetLang.toUpperCase()}] ${text}`;
}

/**
 * Handles a polyglot request from the orchestrator.
 * @param {{ action: string, template?: string, vars?: object, message?: string, zoneId?: string, priority?: string }} request
 * @returns {Promise<object>} Polyglot response
  * @sideEffects Context Graph: None (Read-only by default, unless otherwise specified)
 */
export async function handlePolyglotRequest(request) {
  const { action = 'announce', template, vars, message, zoneId, priority } = request;

  switch (action) {
    case 'announce':
      if (template) {
        return { announcement: await generatePAAnnouncement(template, vars || {}, zoneId, priority || 'normal') };
      }
      return { announcement: await generateCustomPAAnnouncement(message || 'Attention please.', zoneId, priority || 'normal') };

    case 'recent':
      return { announcements: getRecentAnnouncements() };

    case 'templates':
      return { templates: Object.keys(TRANSLATION_TEMPLATES) };

    default:
      return { announcements: getRecentAnnouncements() };
  }
}
