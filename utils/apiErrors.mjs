// Turns a failed request into a message a person can act on. Raw transport
// errors ("fetch failed: Fetch request has been canceled", "Network request
// failed") and generic HTTP reason phrases never reach the screen.
export const API_MESSAGES = {
  timeout: 'Serverul nu răspunde acum. Verifică conexiunea la internet și încearcă din nou.',
  network: 'Nu ne putem conecta la server. Verifică conexiunea la internet și încearcă din nou.',
  rateLimited: 'Prea multe încercări într-un timp scurt. Mai încearcă peste un minut.',
  server: 'A apărut o problemă la server. Încearcă din nou puțin mai târziu.',
  session: 'Sesiunea a expirat. Intră din nou în cont.',
  credentials: 'Email sau parolă greșită.',
  notFound: 'Informația cerută nu mai este disponibilă.',
  generic: 'Cererea nu a putut fi trimisă. Încearcă din nou.',
};

// Backend texts that are technical or terse, mapped to their human form.
const SERVER_TEXTS = new Map([
  ['credențiale invalide', API_MESSAGES.credentials],
  ['neautorizat', API_MESSAGES.session],
  ['token necesar', API_MESSAGES.session],
  ['token invalid', API_MESSAGES.session],
  ['eroare server', API_MESSAGES.server],
]);

const REASON_PHRASE = /^(bad request|unauthorized|forbidden|not found|too many requests|internal server error|request failed|service unavailable|bad gateway|gateway timeout)$/i;

function serverText(body) {
  const text = typeof body === 'string' ? body : typeof body?.error === 'string' ? body.error : '';
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 300 || /^</.test(trimmed) || REASON_PHRASE.test(trimmed)) return null;
  return SERVER_TEXTS.get(trimmed.toLowerCase()) || trimmed;
}

export function describeApiFailure({ timedOut = false, status, body } = {}) {
  if (timedOut) return { kind: 'timeout', message: API_MESSAGES.timeout };
  if (!status) return { kind: 'network', message: API_MESSAGES.network };
  if (status === 429) return { kind: 'rate-limited', message: API_MESSAGES.rateLimited };
  if (status >= 500) return { kind: 'server', message: API_MESSAGES.server };
  const text = serverText(body);
  if (text) return { kind: status === 401 ? 'unauthorized' : 'rejected', message: text };
  if (status === 401) return { kind: 'unauthorized', message: API_MESSAGES.session };
  if (status === 404) return { kind: 'rejected', message: API_MESSAGES.notFound };
  return { kind: 'rejected', message: API_MESSAGES.generic };
}

export function apiError({ timedOut, status, body, cause } = {}) {
  const { kind, message } = describeApiFailure({ timedOut, status, body });
  const error = new Error(message);
  error.kind = kind;
  if (status) error.status = status;
  if (cause) error.cause = cause;
  return error;
}
