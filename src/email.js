import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mjml2html from 'mjml';
import { Resend } from 'resend';

const __dirname = dirname(fileURLToPath(import.meta.url));

let resendClient = null;
const templateCache = new Map();

function getResend() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY nu este configurat');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || 'Dan fost anxios <no-reply@danfostanxios.ro>';
}

function getTemplateSource(templateName) {
  if (templateCache.has(templateName)) return templateCache.get(templateName);
  const templatePath = resolve(__dirname, 'templates', `${templateName}.mjml`);
  const source = readFileSync(templatePath, 'utf8');
  templateCache.set(templateName, source);
  return source;
}

async function compileTemplate(templateName, variables = {}) {
  let mjmlSource = getTemplateSource(templateName);
  for (const [key, value] of Object.entries(variables)) {
    mjmlSource = mjmlSource.replaceAll(`{{${key}}}`, String(value));
  }
  // mjml v5: mjml2html este async si trebuie asteptat, altfel destructuram un Promise.
  const { html, errors } = await mjml2html(mjmlSource, { minify: true });
  if (errors && errors.length) {
    throw new Error(`MJML compilation failed for ${templateName}: ${errors.map((e) => e.message).join('; ')}`);
  }
  if (!html) {
    throw new Error(`MJML compilation returned empty HTML for ${templateName}`);
  }
  return html;
}

/**
 * Sends the password reset email to a user.
 *
 * @param {{ email: string, name?: string, resetToken: string }} params
 * @returns {Promise<{ id: string }>}
 */
export async function sendPasswordResetEmail({ email, name, resetToken }) {
  const currentYear = new Date().getFullYear();
  const token = String(resetToken || '').trim();
  const firstName = String(name || '').trim().split(' ')[0] || '';

  const html = await compileTemplate('reset-password', {
    resetToken: token,
    currentYear: String(currentYear),
    greeting: firstName ? `Salut, ${firstName}!` : 'Salut!',
  });

  const text = [
    firstName ? `Salut, ${firstName}!` : 'Salut!',
    '',
    'Ai solicitat resetarea parolei pentru contul tau din aplicatia Dan fost anxios.',
    '',
    `Codul tau de resetare: ${token}`,
    '',
    'Codul este valabil o ora. Daca nu ai solicitat aceasta resetare, poti ignora acest email.',
  ].join('\n');

  const resend = getResend();
  const from = getFromEmail();

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Resetare parola - Dan fost anxios',
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }

  return data;
}
