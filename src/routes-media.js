import fs from 'fs';
import path from 'path';

const { stat } = fs.promises;

function getBasePath() {
  // Env name provided: FileStorage__BasePath
  const p = process.env.FileStorage__BasePath || process.env.FILESTORAGE__BASEPATH || process.env.FILE_STORAGE_BASE_PATH;
  if (!p) return null;
  return path.resolve(p);
}

function sanitizeFileParam(raw) {
  if (!raw) return null;
  const candidate = raw.toString().replace(/\\/g, '/').trim();
  if (!candidate || candidate.includes('..')) return null;
  return candidate;
}

function inferContentType(resolved) {
  if (resolved.endsWith('.mp4')) return 'video/mp4';
  if (resolved.endsWith('.mov')) return 'video/quicktime';
  if (resolved.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (resolved.endsWith('.ts')) return 'video/mp2t';
  return 'application/octet-stream';
}

function buildEtag(fileStat) {
  return `"${fileStat.size.toString(16)}-${Math.floor(fileStat.mtimeMs).toString(16)}"`;
}

function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  let start = match[1] === '' ? undefined : Number(match[1]);
  let end = match[2] === '' ? undefined : Number(match[2]);

  if (Number.isNaN(start)) start = undefined;
  if (Number.isNaN(end)) end = undefined;

  if (start === undefined && end === undefined) return null;

  if (start === undefined) {
    const suffixLength = end ?? 0;
    if (suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    if (start >= fileSize) return null;
    if (end === undefined || end >= fileSize) end = fileSize - 1;
  }

  if (start > end) return null;
  return { start, end };
}

function validatorMatches(ifRangeValue, etag, lastModifiedUtc) {
  if (!ifRangeValue) return true;
  const trimmed = ifRangeValue.trim();
  if (trimmed.startsWith('W/') || trimmed.startsWith('"')) {
    return trimmed === etag;
  }
  const parsedDate = new Date(trimmed);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toUTCString() === lastModifiedUtc;
}

async function getFileMetadata(basePath, rawParam) {
  const sanitized = sanitizeFileParam(rawParam);
  if (!sanitized) return null;
  const candidatePath = path.join(basePath, sanitized);
  const resolved = path.resolve(candidatePath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  const fileStat = await stat(resolved).catch(() => null);
  if (!fileStat || !fileStat.isFile()) return null;
  return { resolved, fileStat };
}

export async function registerMediaRoutes(app) {
  const basePath = getBasePath();
  const cacheControl = process.env.MEDIA_CACHE_CONTROL || 'public, max-age=86400, immutable';

  if (!basePath) {
    app.log.warn('FileStorage__BasePath is not set; media routes will still mount but return 404');
  } else {
    app.log.info({ basePath }, 'Media base path configured');
  }

  const handler = async (request, reply) => {
    try {
      if (!basePath) return reply.status(404).send({ error: 'Not found' });

      const fileParam = request.params['*'] ?? request.params.file;
      const metadata = await getFileMetadata(basePath, fileParam);
      if (!metadata) return reply.status(404).send({ error: 'Not found' });

      const { resolved, fileStat } = metadata;
      const fileSize = fileStat.size;
      const lastModifiedUtc = fileStat.mtime.toUTCString();
      const etag = buildEtag(fileStat);

      const requestEtag = request.headers['if-none-match'];
      if (!request.headers.range && requestEtag && requestEtag.split(',').map((s) => s.trim()).includes(etag)) {
        reply.code(304);
        reply.header('ETag', etag);
        reply.header('Last-Modified', lastModifiedUtc);
        reply.header('Cache-Control', cacheControl);
        reply.header('Accept-Ranges', 'bytes');
        return reply.send();
      }

      const contentType = inferContentType(resolved);
      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Cache-Control', cacheControl);
      reply.header('Content-Disposition', 'inline');
      reply.header('ETag', etag);
      reply.header('Last-Modified', lastModifiedUtc);
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');

      const rangeHeader = request.headers.range;
      let range = parseRangeHeader(rangeHeader, fileSize);
      if (range && !validatorMatches(request.headers['if-range'], etag, lastModifiedUtc)) {
        range = null;
      }

      if (rangeHeader && !range) {
        reply.code(416);
        reply.header('Content-Range', `bytes */${fileSize}`);
        return reply.send();
      }

      const methodIsHead = request.method === 'HEAD';

      if (range) {
        const { start, end } = range;
        const chunkSize = end - start + 1;
        reply.code(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunkSize);
        if (methodIsHead) {
          return reply.send();
        }
        const stream = fs.createReadStream(resolved, { start, end });
        return reply.send(stream);
      }

      reply.code(200);
      reply.header('Content-Length', fileSize);
      if (methodIsHead) {
        return reply.send();
      }
      const stream = fs.createReadStream(resolved);
      return reply.send(stream);
    } catch (err) {
      request.log.error({ err }, 'Media streaming error');
      return reply.status(500).send({ error: 'Server error' });
    }
  };

  app.route({ method: ['GET', 'HEAD'], url: '/api/media/*', handler });
  app.route({ method: ['GET', 'HEAD'], url: '/api/media/:file', handler });
}
