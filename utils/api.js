import Constants from 'expo-constants';

// Prefer runtime config from Expo constants, then env, then localhost fallback
const fromConstants = Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL || Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const DEFAULT_BASE = fromConstants || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
export const API_BASE_URL = DEFAULT_BASE;

export function toAbsoluteApiUrl(resourceUrl) {
  const raw = String(resourceUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalizedBase = String(DEFAULT_BASE || '').trim().replace(/\/+$/, '');
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildWebSocketUrl(path, token) {
  const base = String(DEFAULT_BASE || '').trim().replace(/\/+$/, '');
  const normalizedPath = `/${String(path || '').trim().replace(/^\/+/, '')}`;

  const wsBase = base.startsWith('https://')
    ? `wss://${base.slice(8)}`
    : base.startsWith('http://')
      ? `ws://${base.slice(7)}`
      : base;

  if (!token) return `${wsBase}${normalizedPath}`;
  const separator = normalizedPath.includes('?') ? '&' : '?';
  return `${wsBase}${normalizedPath}${separator}token=${encodeURIComponent(token)}`;
}

async function request(path, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {
  const headers = {};
  // Fastify respinge cererile cu Content-Type: application/json și body gol (400),
  // deci trimitem header-ul doar când există body.
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${DEFAULT_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = (() => { try { return JSON.parse(text); } catch { return text; } })();
    if (!res.ok) throw new Error(data?.error || data || 'Request failed');
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Server indisponibil. Încearcă din nou.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  register: (payload) => request('/api/custom-auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/custom-auth/login', { method: 'POST', body: payload }),
  oauthGoogle: (id_token) => request('/api/custom-auth/oauth/google', { method: 'POST', body: { id_token } }),
  oauthFacebook: (payload) => request('/api/custom-auth/oauth/facebook', { method: 'POST', body: payload }),
  oauthApple: (id_token, name) => request('/api/custom-auth/oauth/apple', { method: 'POST', body: { id_token, name } }),
  // Progress
  createProgress: (payload, token) => request('/api/progress', { method: 'POST', body: payload, token }),
  listProgress: (token) => request('/api/progress', { method: 'GET', token }),
  getProgress: (id, token) => request(`/api/progress/${id}`, { method: 'GET', token }),
  // Questions
  createQuestion: (payload, token) => request('/api/questions', { method: 'POST', body: payload, token }),
  listMyQuestions: (token) => request('/api/questions', { method: 'GET', token }),
  // Notifications
  registerPushToken: (payload, token) => request('/api/notifications/push-token', { method: 'POST', body: payload, token }),
  unregisterPushToken: (payload, token) => request('/api/notifications/push-token', { method: 'DELETE', body: payload, token }),
  listNotifications: (token, before) => request(
    Number.isFinite(Number(before)) && Number(before) > 0
      ? `/api/notifications?before=${encodeURIComponent(String(before))}`
      : '/api/notifications',
    { method: 'GET', token }
  ),
  getUnreadNotificationsCount: (token) => request('/api/notifications/unread-count', { method: 'GET', token }),
  markNotificationsRead: (token, ids) => request('/api/notifications/read', {
    method: 'POST',
    body: Array.isArray(ids) && ids.length ? { ids } : {},
    token,
  }),
  // Meetings
  createMeeting: (payload, token) => request('/api/meetings', { method: 'POST', body: payload, token }),
  listMyMeetings: (token) => request('/api/meetings', { method: 'GET', token }),
  // Webinars
  listWebinars: (token) => request('/api/webinars', { method: 'GET', token }),
  // Chat
  getChatHistory: (token, before) => request(
    Number.isFinite(Number(before)) && Number(before) > 0
      ? `/chat/history?before=${encodeURIComponent(String(before))}`
      : '/chat/history',
    { method: 'GET', token }
  ),
  markChatAsRead: (token) => request('/chat/read', { method: 'POST', token }),
  // Challenges
  createChallengeRun: (payload, token) => request('/api/challenges/run', { method: 'POST', body: payload, token }),
  listChallengeRuns: (token) => request('/api/challenges/run', { method: 'GET', token }),
  getChallengeRun: (id, token) => request(`/api/challenges/run/${id}`, { method: 'GET', token }),
  // CMS
  getCmsVideoSections: () => request('/api/cms/video-sections', { method: 'GET' }),
  getCmsVideoSection: (slug) => request(`/api/cms/video-sections/${encodeURIComponent(slug)}`, { method: 'GET' }),
  getCmsChallenges: () => request('/api/cms/challenges', { method: 'GET' }),
  // Subscriptions
  getCurrentSubscription: (token) => request('/api/subscriptions/current', { method: 'GET', token }),
  getSubscriptionHistory: (token) => request('/api/subscriptions/history', { method: 'GET', token }),
  syncRevenueCatSubscription: (payload, token) => request('/api/subscriptions/sync', { method: 'POST', body: payload, token }),
  startTrial: (token) => request('/api/subscriptions/start-trial', { method: 'POST', token }),
  createCheckout: (payload, token) => request('/api/subscriptions/create-checkout', { method: 'POST', body: payload, token }),
  createPaymentSheet: (payload, token) => request('/api/subscriptions/create-payment-sheet', { method: 'POST', body: payload, token }),
  getProfile: (token) => request('/api/profile', { method: 'GET', token }),
  updateProfile: (payload, token) => request('/api/profile', { method: 'PUT', body: payload, token }),
  // Account management
  deleteAccount: (token) => request('/api/custom-auth/account', { method: 'DELETE', token }),
  reportBug: (payload, token) => request('/api/bug-report', { method: 'POST', body: payload, token }),
  // Password reset
  requestPasswordReset: (email) => request('/api/custom-auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (payload) => request('/api/custom-auth/reset-password', { method: 'POST', body: payload }),
};
