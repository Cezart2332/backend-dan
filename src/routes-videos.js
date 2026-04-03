import fs from 'fs/promises';
import path from 'path';

function getBasePath() {
  const p = process.env.FileStorage__BasePath || process.env.FILESTORAGE__BASEPATH || process.env.FILE_STORAGE_BASE_PATH;
  if (!p) return null;
  return path.resolve(p);
}

function sanitizeId(raw) {
  if (!raw) return null;
  const id = raw.toString().trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  return id;
}

function sanitizeText(raw, maxLen = 80) {
  if (typeof raw !== 'string') return '';
  const clean = raw.replace(/[\r\n\t]+/g, ' ').trim();
  if (!clean) return '';
  return clean.slice(0, maxLen);
}

function sanitizeHexColor(raw, fallback = '4a90e2') {
  const value = typeof raw === 'string' ? raw.trim().replace('#', '') : '';
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return fallback;
  return value.toLowerCase();
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildArtworkSvg({ title, artist, accent }) {
  const t = escapeXml(title || 'Dan fost anxios');
  const a = escapeXml(artist || 'Dan fost anxios');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Now playing artwork">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2238" />
      <stop offset="100%" stop-color="#243b56" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#${accent}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.18" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)" />
  <circle cx="860" cy="190" r="230" fill="url(#accent)" opacity="0.45" />
  <circle cx="180" cy="940" r="280" fill="#${accent}" opacity="0.20" />
  <rect x="84" y="720" width="856" height="220" rx="34" fill="#0e1824" fill-opacity="0.55" />
  <text x="120" y="815" fill="#f4f8ff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${t}</text>
  <text x="120" y="880" fill="#d6e4f8" font-family="Arial, sans-serif" font-size="38" font-weight="500">${a}</text>
  <rect x="84" y="84" width="180" height="180" rx="28" fill="#ffffff" fill-opacity="0.14" />
  <path d="M174 133v84.5a34.5 34.5 0 1 1-18-30.2V105l118-21v84.5a34.5 34.5 0 1 1-18-30.2v-32.8l-82 14.6z" fill="#ffffff" fill-opacity="0.9" />
</svg>`;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function registerVideoRoutes(app) {
  const basePath = getBasePath();
  const hlsRoot = basePath ? path.join(basePath, 'hls') : null;

  app.get('/api/videos/:id', async (request, reply) => {
    if (!hlsRoot) return reply.status(500).send({ error: 'File storage not configured' });

    const id = sanitizeId(request.params.id);
    if (!id) return reply.status(400).send({ error: 'Invalid video id' });

    const playlistPath = path.join(hlsRoot, id, 'master.m3u8');
    const exists = await fileExists(playlistPath);
    if (!exists) return reply.status(404).send({ error: 'Not found' });

    const hlsUrl = `/api/media/hls/${id}/master.m3u8`;
    return { id, hlsUrl };
  });

  app.get('/api/videos/:id/artwork', async (request, reply) => {
    const id = sanitizeId(request.params.id);
    if (!id) return reply.status(400).send({ error: 'Invalid video id' });

    const title = sanitizeText(request.query?.title, 70) || id.replace(/[_-]+/g, ' ');
    const artist = sanitizeText(request.query?.artist, 70) || 'Dan fost anxios';
    const accent = sanitizeHexColor(request.query?.accent, '4a90e2');
    const svg = buildArtworkSvg({ title, artist, accent });

    reply.header('Content-Type', 'image/svg+xml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(svg);
  });
}
