import Constants from 'expo-constants';

// Prefer runtime config from Expo constants, then env, then localhost fallback
const fromConstants = Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_URL || Constants?.manifest?.extra?.EXPO_PUBLIC_API_URL;
const DEFAULT_BASE = fromConstants || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
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
  oauthApple: (id_token) => request('/api/custom-auth/oauth/apple', { method: 'POST', body: { id_token } }),
  // Progress
  createProgress: (payload, token) => request('/api/progress', { method: 'POST', body: payload, token }),
  listProgress: (token) => request('/api/progress', { method: 'GET', token }),
  getProgress: (id, token) => request(`/api/progress/${id}`, { method: 'GET', token }),
  // Questions
  createQuestion: (payload, token) => request('/api/questions', { method: 'POST', body: payload, token }),
  listMyQuestions: (token) => request('/api/questions', { method: 'GET', token }),
  // Challenges
  createChallengeRun: (payload, token) => request('/api/challenges/run', { method: 'POST', body: payload, token }),
  listChallengeRuns: (token) => request('/api/challenges/run', { method: 'GET', token }),
  getChallengeRun: (id, token) => request(`/api/challenges/run/${id}`, { method: 'GET', token }),
  // Subscriptions
  getCurrentSubscription: (token) => request('/api/subscriptions/current', { method: 'GET', token }),
  getSubscriptionHistory: (token) => request('/api/subscriptions/history', { method: 'GET', token }),
  startTrial: (token) => request('/api/subscriptions/start-trial', { method: 'POST', token }),
  createCheckout: (payload, token) => request('/api/subscriptions/create-checkout', { method: 'POST', body: payload, token }),
  createPaymentSheet: (payload, token) => request('/api/subscriptions/create-payment-sheet', { method: 'POST', body: payload, token }),
  // Account management
  deleteAccount: (token) => request('/api/custom-auth/account', { method: 'DELETE', token }),
  reportBug: (payload, token) => request('/api/bug-report', { method: 'POST', body: payload, token }),
};
