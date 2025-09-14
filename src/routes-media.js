import fs from 'fs';
import path from 'path';

function getBasePath() {
  // Env name provided: FileStorage__BasePath
  const p = process.env.FileStorage__BasePath || process.env.FILESTORAGE__BASEPATH || process.env.FILE_STORAGE_BASE_PATH;
  if (!p) return null;
  return path.resolve(p);
}

export async function registerMediaRoutes(app) {
  const basePath = getBasePath();
  if (!basePath) {
    app.log.warn('FileStorage__BasePath is not set; media routes will still mount but return 404');
  } else {
    app.log.info({ basePath }, 'Media base path configured');
  }

  app.get('/api/media/:file', async (request, reply) => {
    try {
      const fileParam = request.params.file;
      if (!fileParam || /\.{2}/.test(fileParam)) return reply.status(400).send({ error: 'Invalid file' });
      if (!basePath) return reply.status(404).send({ error: 'Not found' });

      const filePath = path.join(basePath, fileParam);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(basePath)) return reply.status(403).send({ error: 'Forbidden' });
      if (!fs.existsSync(resolved)) return reply.status(404).send({ error: 'Not found' });

      const stat = fs.statSync(resolved);
      const fileSize = stat.size;
      const range = request.headers.range;

      const contentType = resolved.endsWith('.mp4')
        ? 'video/mp4'
        : resolved.endsWith('.mov')
        ? 'video/quicktime'
        : 'application/octet-stream';

      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Cache-Control', 'no-store');
      reply.header('Content-Disposition', 'inline');

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (!match) {
          reply.code(416).send();
          return;
        }
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        if (isNaN(start) || isNaN(end) || start > end || end >= fileSize) {
          reply.code(416).send();
          return;
        }
        const chunkSize = end - start + 1;
        reply.code(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Content-Length', chunkSize);
        const stream = fs.createReadStream(resolved, { start, end });
        return reply.send(stream);
      } else {
        reply.header('Content-Length', fileSize);
        const stream = fs.createReadStream(resolved);
        return reply.send(stream);
      }
    } catch (err) {
      request.log.error({ err }, 'Media streaming error');
      return reply.status(500).send({ error: 'Server error' });
    }
  });
}
