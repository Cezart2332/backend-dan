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
}
