import { mysqlPool } from './mysql.js';

export async function registerCmsRoutes(app) {
  // ─── Video Sections ───
  app.get('/api/cms/video-sections', async (request, reply) => {
    try {
      const [rows] = await mysqlPool.query(
        `SELECT id, title, slug, description, sort_order
         FROM cms_video_sections
         WHERE is_active = 1
         ORDER BY sort_order, id`
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'CMS list sections failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Single Section with Subsections & Videos ───
  app.get('/api/cms/video-sections/:slug', async (request, reply) => {
    const slug = String(request.params.slug || '').trim();
    if (!slug) return reply.code(400).send({ error: 'Slug necesar' });

    try {
      const [sections] = await mysqlPool.query(
        `SELECT id, title, slug, description, sort_order
         FROM cms_video_sections
         WHERE slug = ? AND is_active = 1 LIMIT 1`,
        [slug]
      );
      if (!Array.isArray(sections) || !sections.length) {
        return reply.code(404).send({ error: 'Sectiune inexistenta' });
      }
      const section = sections[0];

      const [subRows] = await mysqlPool.query(
        `SELECT id, section_id, title, description, icon_name, icon_color, icon_bg, sort_order
         FROM cms_video_subsections
         WHERE section_id = ? AND is_active = 1
         ORDER BY sort_order, id`,
        [section.id]
      );

      const subsections = [];
      for (const sub of subRows) {
        const [vidRows] = await mysqlPool.query(
          `SELECT id, subsection_id, title, description, storage_key, badge, sort_order, encoding_status
           FROM cms_videos
           WHERE subsection_id = ? AND is_active = 1
           ORDER BY sort_order, id`,
          [sub.id]
        );
        subsections.push({ ...sub, videos: vidRows });
      }

      return reply.send({ section, subsections });
    } catch (e) {
      request.log.error({ err: e }, 'CMS get section failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Challenges ───
  app.get('/api/cms/challenges', async (request, reply) => {
    try {
      const [levelRows] = await mysqlPool.query(
        `SELECT id, title, goal, color, gradient_colors, difficulty, duration, sort_order
         FROM cms_challenge_levels
         WHERE is_active = 1
         ORDER BY sort_order, id`
      );

      const levels = [];
      for (const lvl of levelRows) {
        const [challengeRows] = await mysqlPool.query(
          `SELECT id, level_id, title, est, sort_order
           FROM cms_challenges
           WHERE level_id = ? AND is_active = 1
           ORDER BY sort_order, id`,
          [lvl.id]
        );
        levels.push({ ...lvl, challenges: challengeRows });
      }

      return reply.send({ levels });
    } catch (e) {
      request.log.error({ err: e }, 'CMS list challenges failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}
