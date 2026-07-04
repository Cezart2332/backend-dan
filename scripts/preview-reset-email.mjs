import { readFileSync, writeFileSync } from 'node:fs';
import mjml2html from 'mjml';

let src = readFileSync(new URL('../src/templates/reset-password.mjml', import.meta.url), 'utf8');
src = src
  .replaceAll('{{resetToken}}', 'a3f9c1e07b2d48d6a3f9c1e07b2d48d6a3f9c1e07b2d48d6a3f9c1e07b2d48d6')
  .replaceAll('{{currentYear}}', '2026')
  .replaceAll('{{greeting}}', 'Salut, Cezar!');

const res = await mjml2html(src, { minify: true });
if (res.errors?.length) {
  console.error('MJML errors:', JSON.stringify(res.errors, null, 2));
  process.exit(1);
}

// Doar pentru preview local: inlocuim URL-ul remote al logo-ului cu o versiune base64,
// ca sa se vada in screenshot fara acces la server.
const logo = readFileSync(new URL('../assets/email-logo.png', import.meta.url)).toString('base64');
const html = res.html.replaceAll(
  'https://api.danfostanxios.ro/assets/email-logo.png',
  `data:image/png;base64,${logo}`
);

writeFileSync('/tmp/reset-preview.html', html);
console.log('html length:', html.length);
console.log('preview written to /tmp/reset-preview.html');
