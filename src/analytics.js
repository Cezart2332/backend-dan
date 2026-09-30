import jwt from "jsonwebtoken";
import { parse } from "csv-parse/sync";
import {
  normalizeExportRow,
  exportLifecycle,
  saveRevenueLifecycle,
  saveRevenueTransaction,
  PAID_PLANS,
} from "./revenue-ledger.js";
import contentLabels from "./content-labels.json" with { type: "json" };

const DAY = 86400000;
const sqlDate = (date) => date.toISOString().slice(0, 23).replace("T", " ");
const n = (value) => Number(value || 0);
const rate = (part, total) =>
  total ? Math.round((part / total) * 1000) / 10 : null;
export const activePaidSql = (
  s = "s",
) => `${s}.type IN ('basic','premium','pro','vip')
  AND COALESCE(${s}.revenuecat_period_type,'NORMAL') <> 'TRIAL'
  AND ${s}.starts_at <= UTC_TIMESTAMP() AND (${s}.ends_at IS NULL OR ${s}.ends_at > UTC_TIMESTAMP())
  AND NOT EXISTS (SELECT 1 FROM subscriptions newer WHERE newer.user_id = ${s}.user_id
    AND newer.type IN ('basic','premium','pro','vip') AND COALESCE(newer.revenuecat_period_type,'NORMAL') <> 'TRIAL'
    AND newer.starts_at <= UTC_TIMESTAMP() AND (newer.ends_at IS NULL OR newer.ends_at > UTC_TIMESTAMP())
    AND (newer.starts_at > ${s}.starts_at OR (newer.starts_at = ${s}.starts_at AND newer.id > ${s}.id)))`;

const subscriptionStoreSql = `CASE
  WHEN UPPER(TRIM(s.revenuecat_store)) IN ('GOOGLE_PLAY','PLAY_STORE') THEN 'GOOGLE_PLAY'
  WHEN UPPER(TRIM(s.revenuecat_store)) = 'APP_STORE' THEN 'APP_STORE'
  ELSE 'OTHER' END`;
const storeCounts = (rows) =>
  rows.map((row) => ({ store: row.store, total: n(row.total) }));

export function analyticsPeriod(query = {}, now = new Date()) {
  const parseDay = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || ""))
      throw new Error("Alege o perioadă validă.");
    const date = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new Error("Dată invalidă.");
    return date;
  };
  const defaultTo = now.toISOString().slice(0, 10);
  const from = parseDay(
    query.from ||
      new Date(Date.parse(defaultTo) - 29 * DAY).toISOString().slice(0, 10),
  );
  const endDay = parseDay(query.to || defaultTo),
    to = new Date(+endDay + DAY);
  if (
    +to <= +from ||
    (+to - +from) / DAY > 1096 ||
    from.getUTCFullYear() < 2000 ||
    +endDay > Date.parse(defaultTo)
  )
    throw new Error(
      "Perioada trebuie să aibă între 1 și 1096 de zile și să nu fie în viitor.",
    );
  const group = query.group || ((+to - +from) / DAY > 93 ? "month" : "day");
  const currency = String(query.currency || "USD").toUpperCase();
  if (!["day", "month"].includes(group) || !/^[A-Z]{3}$/.test(currency))
    throw new Error("Filtru invalid.");
  if (query.compare && !["year", "previous"].includes(query.compare))
    throw new Error("Comparație invalidă.");
  const comparison = query.compare || "previous";
  const previousYear = (date) => {
    const year = date.getUTCFullYear() - 1,
      month = date.getUTCMonth(),
      day = date.getUTCDate();
    return new Date(
      Date.UTC(
        year,
        month,
        Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
      ),
    );
  };
  return {
    from,
    to,
    previousFrom:
      comparison === "year"
        ? previousYear(from)
        : new Date(+from - (+to - +from)),
    previousTo:
      comparison === "year" ? new Date(+previousYear(endDay) + DAY) : from,
    group,
    currency,
    comparison,
  };
}

export function fillSeries(rows, period, keys) {
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const result = [],
    cursor = new Date(period.from);
  if (period.group === "month") cursor.setUTCDate(1);
  while (+cursor < +period.to) {
    const bucket = cursor
      .toISOString()
      .slice(0, period.group === "month" ? 7 : 10);
    const row = byBucket.get(bucket) || {};
    result.push({
      bucket,
      ...Object.fromEntries(keys.map((key) => [key, n(row[key])])),
    });
    if (period.group === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export async function loadAnalytics(pool, query, now = new Date()) {
  const p = analyticsPeriod(query, now),
    range = [sqlDate(p.from), sqlDate(p.to)];
  const bucket = (field) =>
    `DATE_FORMAT(${field}, '${p.group === "month" ? "%Y-%m" : "%Y-%m-%d"}')`;
  const amount = p.currency === "USD" ? "amount_usd" : "amount";
  const currencyClause = p.currency === "USD" ? "1 = 1" : "currency = ?";
  const cArgs = p.currency === "USD" ? [] : [p.currency];
  const money = `SUM(CASE WHEN kind='payment' THEN COALESCE(${amount},0) ELSE 0 END) AS gross,
    SUM(CASE WHEN kind='refund' THEN COALESCE(${amount},0) ELSE 0 END) AS refunds,
    SUM(CASE WHEN kind='payment' THEN COALESCE(${amount},0) ELSE -COALESCE(${amount},0) END) AS net,
    COUNT(CASE WHEN kind='payment' THEN 1 END) AS payments,
    COUNT(CASE WHEN ${amount} IS NULL THEN 1 END) AS missingAmounts`;
  // Three concurrent aggregates at a time: leave pool capacity for app traffic.
  const jobs = {
    revenue: [
      `SELECT ${money} FROM revenue_transactions WHERE environment='PRODUCTION' AND ${currencyClause} AND occurred_at >= ? AND occurred_at < ?`,
      [...cArgs, ...range],
    ],
    previousRevenue: [
      `SELECT ${money} FROM revenue_transactions WHERE environment='PRODUCTION' AND ${currencyClause} AND occurred_at >= ? AND occurred_at < ?`,
      [...cArgs, sqlDate(p.previousFrom), sqlDate(p.previousTo)],
    ],
    revenueSeries: [
      `SELECT ${bucket("occurred_at")} AS bucket, ${money} FROM revenue_transactions WHERE environment='PRODUCTION' AND ${currencyClause} AND occurred_at >= ? AND occurred_at < ? GROUP BY bucket ORDER BY bucket`,
      [...cArgs, ...range],
    ],
    byPlan: [
      `SELECT plan,${money} FROM revenue_transactions WHERE environment='PRODUCTION' AND ${currencyClause} AND occurred_at >= ? AND occurred_at < ? GROUP BY plan`,
      [...cArgs, ...range],
    ],
    byStore: [
      `SELECT store,${money} FROM revenue_transactions WHERE environment='PRODUCTION' AND ${currencyClause} AND occurred_at >= ? AND occurred_at < ? GROUP BY store`,
      [...cArgs, ...range],
    ],
    currencies: [
      "SELECT DISTINCT currency FROM revenue_transactions WHERE environment='PRODUCTION' AND currency IS NOT NULL ORDER BY currency",
      [],
    ],
    coverage: [
      `SELECT (SELECT MIN(occurred_at) FROM revenue_transactions WHERE environment='PRODUCTION') AS revenueSince,
      (SELECT MIN(occurred_at) FROM revenue_events WHERE environment='PRODUCTION' AND event_id NOT LIKE 'export:%') AS lifecycleSince,
      (SELECT MIN(activity_date) FROM app_activity_days) AS activitySince,
      (SELECT MIN(started_at) FROM challenge_attempts) AS attemptsSince`,
      [],
    ],
    paid: [
      `SELECT s.type AS plan, COUNT(*) AS total FROM subscriptions s WHERE ${activePaidSql()} GROUP BY s.type`,
      [],
    ],
    paidByStore: [
      `SELECT ${subscriptionStoreSql} AS store, COUNT(*) AS total FROM subscriptions s WHERE ${activePaidSql()} GROUP BY store`,
      [],
    ],
    trial: [
      `SELECT COUNT(DISTINCT s.user_id) AS total FROM subscriptions s WHERE s.type='trial' AND s.starts_at <= UTC_TIMESTAMP()
      AND (s.ends_at IS NULL OR s.ends_at > UTC_TIMESTAMP()) AND NOT EXISTS (SELECT 1 FROM subscriptions paid WHERE paid.user_id=s.user_id AND ${activePaidSql("paid")})`,
      [],
    ],
    lifecycle: [
      `SELECT COUNT(DISTINCT CASE WHEN event_type='RENEWAL' AND trial_conversion=0 AND period_type<>'TRIAL' THEN transaction_id END) AS renewals,
      COUNT(DISTINCT CASE WHEN event_type='EXPIRATION' AND period_type<>'TRIAL' THEN user_id END) AS expiredUsers,
      COUNT(DISTINCT CASE WHEN event_type='CANCELLATION' THEN transaction_id END) AS cancellations FROM revenue_events
      WHERE environment='PRODUCTION' AND occurred_at >= ? AND occurred_at < ?`,
      range,
    ],
    firstPayments: [
      `SELECT COUNT(*) AS total FROM (SELECT user_id,MIN(occurred_at) AS first_at FROM revenue_transactions
      WHERE environment='PRODUCTION' AND kind='payment' AND user_id IS NOT NULL AND (amount>0 OR amount_usd>0) GROUP BY user_id) paid
      WHERE first_at >= ? AND first_at < ?`,
      range,
    ],
    conversions: [
      `SELECT COUNT(*) AS trials,COUNT(CASE WHEN EXISTS (SELECT 1 FROM revenue_transactions t WHERE t.user_id=trials.user_id
      AND t.environment='PRODUCTION' AND t.kind='payment' AND (t.amount>0 OR t.amount_usd>0) AND t.occurred_at >= trials.first_at AND t.occurred_at < ?) THEN 1 END) AS converted
      FROM (SELECT user_id,MIN(first_at) AS first_at FROM (
        SELECT user_id,MIN(starts_at) AS first_at FROM subscriptions WHERE type='trial' GROUP BY user_id
        UNION ALL SELECT user_id,MIN(occurred_at) AS first_at FROM revenue_events WHERE environment='PRODUCTION' AND period_type='TRIAL' AND event_type='INITIAL_PURCHASE' AND user_id IS NOT NULL GROUP BY user_id
      ) trial_history GROUP BY user_id) trials WHERE trials.first_at >= ? AND trials.first_at < ?`,
      [range[1], ...range],
    ],
    users: [
      `SELECT (SELECT COUNT(*) FROM users) AS total,
      (SELECT COUNT(*) FROM users WHERE created_at>=? AND created_at<?) AS newUsers,
      (SELECT COUNT(DISTINCT user_id) FROM app_activity_days WHERE activity_date>=DATE(?) AND activity_date<DATE(?)) AS activeUsers`,
      [...range, ...range],
    ],
    retention: [
      `SELECT COUNT(CASE WHEN DATE(u.created_at)<=DATE_SUB(UTC_DATE(),INTERVAL 7 DAY) THEN 1 END) AS eligible7,
      COUNT(CASE WHEN DATE(u.created_at)<=DATE_SUB(UTC_DATE(),INTERVAL 7 DAY) AND EXISTS(SELECT 1 FROM app_activity_days a WHERE a.user_id=u.id AND a.activity_date=DATE_ADD(DATE(u.created_at),INTERVAL 7 DAY)) THEN 1 END) AS returned7,
      COUNT(CASE WHEN DATE(u.created_at)<=DATE_SUB(UTC_DATE(),INTERVAL 30 DAY) THEN 1 END) AS eligible30,
      COUNT(CASE WHEN DATE(u.created_at)<=DATE_SUB(UTC_DATE(),INTERVAL 30 DAY) AND EXISTS(SELECT 1 FROM app_activity_days a WHERE a.user_id=u.id AND a.activity_date=DATE_ADD(DATE(u.created_at),INTERVAL 30 DAY)) THEN 1 END) AS returned30
      FROM users u WHERE u.created_at>=? AND u.created_at<? AND DATE(u.created_at)>=(SELECT MIN(activity_date) FROM app_activity_days)`,
      range,
    ],
    videos: [
      `SELECT COUNT(*) AS sessions,COUNT(CASE WHEN completed=1 THEN 1 END) AS completed,COALESCE(SUM(listened_ms),0)/60000 AS minutes FROM audio_activity WHERE occurred_at>=? AND occurred_at<?`,
      range,
    ],
    videoTop: [
      `SELECT a.media_key AS mediaKey,COALESCE(MAX(v.title),a.media_key) AS title,COUNT(*) AS sessions,
      SUM(a.completed) AS completed,SUM(a.listened_ms)/60000 AS minutes FROM audio_activity a
      LEFT JOIN (SELECT storage_key,MAX(title) AS title FROM cms_videos GROUP BY storage_key) v ON v.storage_key=a.media_key
      WHERE a.occurred_at>=? AND a.occurred_at<? GROUP BY a.media_key ORDER BY minutes DESC LIMIT 10`,
      range,
    ],
    challenges: [
      `SELECT (SELECT COUNT(*) FROM challenge_runs WHERE COALESCE(client_date,created_at)>=? AND COALESCE(client_date,created_at)<?) AS completed,
      COUNT(*) AS started,COUNT(completed_at) AS attemptsCompleted FROM challenge_attempts WHERE started_at>=? AND started_at<?`,
      [...range, ...range],
    ],
    challengeTop: [
      `SELECT challenge_id AS challengeId,COUNT(*) AS completed,AVG(difficulty) AS difficulty FROM challenge_runs WHERE COALESCE(client_date,created_at)>=? AND COALESCE(client_date,created_at)<? GROUP BY challenge_id ORDER BY completed DESC LIMIT 10`,
      range,
    ],
    sos: [
      `SELECT COUNT(*) AS sessions,SUM(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.status'))='completed') AS completed,
      SUM(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.feedback.rating'))='helpful') AS helpful,
      SUM(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.feedback.rating'))='neutral') AS neutral,
      SUM(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.feedback.rating'))='unhelpful') AS unhelpful,
      SUM(JSON_CONTAINS(JSON_EXTRACT(payload,'$.techniques'),'"breathing"')) AS breathing,
      SUM(JSON_CONTAINS(JSON_EXTRACT(payload,'$.techniques'),'"grounding"')) AS grounding FROM wellbeing_sessions WHERE occurred_at>=? AND occurred_at<?`,
      range,
    ],
    checkins: [
      `SELECT COUNT(*) AS total,COUNT(DISTINCT user_id) AS users FROM wellbeing_checkins WHERE occurred_at>=? AND occurred_at<?`,
      range,
    ],
    dan: [
      `SELECT (SELECT COUNT(*) FROM questions WHERE status<>'archived' AND (admin_response IS NULL OR TRIM(admin_response)='')) AS unanswered,
      COUNT(*) AS questions,COUNT(responded_at) AS answered,
      AVG(CASE WHEN responded_at>=created_at THEN TIMESTAMPDIFF(SECOND,created_at,responded_at)/3600 END) AS replyHours,
      (SELECT COUNT(*) FROM bug_reports WHERE status IN ('new','in_progress')) AS openBugs,
      (SELECT COUNT(*) FROM meetings WHERE scheduled_at>=? AND scheduled_at<? AND status='completed') AS completedMeetings
      FROM questions WHERE created_at>=? AND created_at<?`,
      [...range, ...range],
    ],
    activitySeries: [
      `SELECT bucket,SUM(users) AS users,SUM(videos) AS videos,SUM(challenges) AS challenges,SUM(sos) AS sos,SUM(checkins) AS checkins FROM (
      SELECT ${bucket("activity_date")} AS bucket,COUNT(DISTINCT user_id) AS users,0 AS videos,0 AS challenges,0 AS sos,0 AS checkins FROM app_activity_days WHERE activity_date>=DATE(?) AND activity_date<DATE(?) GROUP BY bucket
      UNION ALL SELECT ${bucket("occurred_at")},0,COUNT(*),0,0,0 FROM audio_activity WHERE completed=1 AND occurred_at>=? AND occurred_at<? GROUP BY 1
      UNION ALL SELECT ${bucket("COALESCE(client_date,created_at)")},0,0,COUNT(*),0,0 FROM challenge_runs WHERE COALESCE(client_date,created_at)>=? AND COALESCE(client_date,created_at)<? GROUP BY 1
      UNION ALL SELECT ${bucket("occurred_at")},0,0,0,COUNT(*),0 FROM wellbeing_sessions WHERE occurred_at>=? AND occurred_at<? GROUP BY 1
      UNION ALL SELECT ${bucket("occurred_at")},0,0,0,0,COUNT(*) FROM wellbeing_checkins WHERE occurred_at>=? AND occurred_at<? GROUP BY 1
      ) activity GROUP BY bucket ORDER BY bucket`,
      [...range, ...range, ...range, ...range, ...range],
    ],
  };
  const results = {},
    entries = Object.entries(jobs);
  for (let i = 0; i < entries.length; i += 3)
    await Promise.all(
      entries.slice(i, i + 3).map(async ([key, [sql, args]]) => {
        const [rows] = await pool.query(sql, args);
        results[key] = rows;
      }),
    );
  const one = (key) =>
    Object.fromEntries(
      Object.entries(results[key][0] || {}).map(([k, v]) => [
        k,
        v == null ? null : n(v),
      ]),
    );
  const revenue = one("revenue"),
    previous = one("previousRevenue"),
    videos = one("videos"),
    challenges = one("challenges"),
    retention = one("retention"),
    conversions = one("conversions");
  return {
    period: {
      from: p.from.toISOString().slice(0, 10),
      to: new Date(+p.to - DAY).toISOString().slice(0, 10),
      group: p.group,
      currency: p.currency,
      timezone: "UTC",
      comparison: p.comparison,
      previousFrom: p.previousFrom.toISOString().slice(0, 10),
      previousTo: new Date(+p.previousTo - DAY).toISOString().slice(0, 10),
    },
    generatedAt: now.toISOString(),
    coverage: results.coverage[0],
    currencies: [
      ...new Set(["USD", ...results.currencies.map((r) => r.currency)]),
    ],
    revenue: {
      ...revenue,
      previous,
      changePercent:
        previous.net > 0
          ? rate(revenue.net - previous.net, previous.net)
          : null,
      series: fillSeries(results.revenueSeries, p, ["gross", "refunds", "net"]),
      byPlan: results.byPlan,
      byStore: results.byStore,
    },
    subscriptions: {
      active: results.paid.reduce((sum, r) => sum + n(r.total), 0),
      byStore: storeCounts(results.paidByStore),
      byPlan: PAID_PLANS.map((plan) => ({
        plan,
        total: n(results.paid.find((r) => r.plan === plan)?.total),
      })),
      activeTrials: n(results.trial[0]?.total),
      ...one("lifecycle"),
      firstPayments: n(results.firstPayments[0]?.total),
      ...conversions,
      conversionRate: rate(conversions.converted, conversions.trials),
    },
    users: {
      ...one("users"),
      ...retention,
      retention7: rate(retention.returned7, retention.eligible7),
      retention30: rate(retention.returned30, retention.eligible30),
    },
    videos: {
      ...videos,
      completionRate: rate(videos.completed, videos.sessions),
      top: results.videoTop.map((row) => ({
        ...row,
        title:
          row.title === row.mediaKey
            ? contentLabels.videos[row.mediaKey] || row.title
            : row.title,
      })),
    },
    challenges: {
      ...challenges,
      completionRate: rate(challenges.attemptsCompleted, challenges.started),
      top: results.challengeTop.map((row) => ({
        ...row,
        title: contentLabels.challenges[row.challengeId] || row.challengeId,
      })),
    },
    sos: one("sos"),
    checkins: one("checkins"),
    dan: one("dan"),
    activitySeries: fillSeries(results.activitySeries, p, [
      "users",
      "videos",
      "challenges",
      "sos",
      "checkins",
    ]),
  };
}

export async function registerAnalyticsRoutes(
  app,
  { pool, jwtSecret, adminAuth },
) {
  const admin = async (req, reply) => {
    if (!(await adminAuth(req)))
      return reply.code(403).send({ error: "Forbidden" });
  };
  const user = async (req, reply) => {
    try {
      req.analyticsUser = Number(
        jwt.verify(
          String(req.headers.authorization || "").replace(/^Bearer /, ""),
          jwtSecret,
        ).sub,
      );
      if (!Number.isSafeInteger(req.analyticsUser) || req.analyticsUser < 1)
        throw new Error();
      const [rows] = await pool.query("SELECT id FROM users WHERE id=?", [
        req.analyticsUser,
      ]);
      if (!rows.length) throw new Error();
    } catch {
      return reply.code(401).send({ error: "Neautorizat" });
    }
  };
  app.get("/api/admin/analytics", { preHandler: admin }, async (req, reply) => {
    try {
      analyticsPeriod(req.query);
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }
    return loadAnalytics(pool, req.query);
  });
  app.get(
    "/api/admin/subscriptions",
    { preHandler: admin },
    async (req, reply) => {
      const page = Number(req.query.page || 1),
        limit = Number(req.query.limit || 25),
        plan = req.query.plan || "";
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (plan && !PAID_PLANS.includes(plan))
      )
        return reply.code(400).send({ error: "Filtre invalide." });
      const where = [activePaidSql()],
        args = [];
      if (plan) {
        where.push("s.type=?");
        args.push(plan);
      }
      if (req.query.search) {
        where.push("(u.email LIKE ? OR u.name LIKE ?)");
        args.push(
          `%${String(req.query.search).slice(0, 200)}%`,
          `%${String(req.query.search).slice(0, 200)}%`,
        );
      }
      const [[count]] = await pool.query(
        `SELECT COUNT(*) AS total FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE ${where.join(" AND ")}`,
        args,
      );
      const [items] = await pool.query(
        `SELECT s.id,s.user_id,u.email,u.name,s.type,s.starts_at,s.ends_at,s.revenuecat_store AS store,s.revenuecat_will_renew AS willRenew FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE ${where.join(" AND ")} ORDER BY s.starts_at DESC,s.id DESC LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      const [byStore] = await pool.query(
        `SELECT ${subscriptionStoreSql} AS store, COUNT(*) AS total FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE ${where.join(" AND ")} GROUP BY store`,
        args,
      );
      return {
        items,
        total: n(count.total),
        byStore: storeCounts(byStore),
        page,
        limit,
      };
    },
  );
  app.post(
    "/api/admin/analytics/import",
    {
      preHandler: admin,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      let rows, entries;
      try {
        if (
          typeof req.body?.csv !== "string" ||
          Buffer.byteLength(req.body.csv) > 4 * 1024 * 1024
        )
          throw new Error("Alege un export CSV de maximum 4 MB.");
        rows = parse(req.body.csv, {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
        });
        if (!rows.length || rows.length > 10000)
          throw new Error("Importul acceptă între 1 și 10.000 de tranzacții.");
        entries = rows.map((row) => ({
          owners: [
            Number(row.rc_last_seen_app_user_id_alias),
            Number(row.rc_original_app_user_id),
          ],
          entries: normalizeExportRow(row),
          row,
        }));
      } catch (e) {
        return reply.code(400).send({ error: e.message });
      }
      const db = await pool.getConnection();
      try {
        await db.beginTransaction();
        let imported = 0,
          skipped = 0;
        for (const item of entries) {
          const owners = item.owners.filter(
            (owner) => Number.isSafeInteger(owner) && owner > 0,
          );
          const [users] = owners.length
            ? await db.query(
                `SELECT id FROM users WHERE id IN (${owners.map(() => "?").join(",")}) ORDER BY FIELD(id,${owners.map(() => "?").join(",")}) LIMIT 1`,
                [...owners, ...owners],
              )
            : [[]];
          if (!item.entries.length) skipped++;
          for (const entry of item.entries) {
            await saveRevenueTransaction(db, users[0]?.id || null, entry);
            imported++;
          }
          if (
            String(item.row.ownership_type || "").toUpperCase() !==
              "FAMILY_SHARED" &&
            String(item.row.store).toUpperCase() !== "PROMOTIONAL"
          ) {
            for (const event of exportLifecycle(item.row))
              await saveRevenueLifecycle(db, event, users[0]?.id || null);
          }
        }
        await db.commit();
        return { rows: rows.length, entries: imported, skipped };
      } catch (e) {
        await db.rollback();
        throw e;
      } finally {
        db.release();
      }
    },
  );
  app.post("/api/activity/visit", { preHandler: user }, async (req, reply) => {
    const { day, platform } = req.body || {},
      date = new Date(`${day}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day || "") ||
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== day ||
      +date > Date.now() ||
      +date < Date.now() - 90 * DAY ||
      !["ios", "android", "web"].includes(platform)
    )
      return reply.code(400).send({ error: "Activitate invalidă." });
    await pool.query(
      "INSERT INTO app_activity_days (user_id,activity_date,platform) VALUES (?,?,?) ON DUPLICATE KEY UPDATE platform=VALUES(platform)",
      [req.analyticsUser, day, platform],
    );
    return { ok: true };
  });
  app.post(
    "/api/activity/challenge",
    { preHandler: user },
    async (req, reply) => {
      const v = req.body || {},
        started = new Date(v.startedAt),
        completed = v.completedAt ? new Date(v.completedAt) : null;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          v.clientId || "",
        ) ||
        typeof v.challengeId !== "string" ||
        v.challengeId.length > 128 ||
        !v.challengeId ||
        !Number.isFinite(+started) ||
        +started > Date.now() + 300000 ||
        +started < Date.now() - 90 * DAY ||
        (completed &&
          (!Number.isFinite(+completed) ||
            +completed < +started ||
            +completed > Date.now() + 300000))
      )
        return reply.code(400).send({ error: "Provocare invalidă." });
      const [existing] = await pool.query(
        "SELECT challenge_id,started_at FROM challenge_attempts WHERE user_id=? AND client_id=?",
        [req.analyticsUser, v.clientId],
      );
      if (
        existing[0] &&
        (existing[0].challenge_id !== v.challengeId ||
          +new Date(existing[0].started_at) !== +started)
      )
        return reply
          .code(409)
          .send({ error: "Identificator folosit pentru altă provocare." });
      await pool.query(
        `INSERT INTO challenge_attempts (user_id,client_id,challenge_id,started_at,completed_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE
      completed_at=IF(challenge_id=VALUES(challenge_id) AND started_at=VALUES(started_at),COALESCE(completed_at,VALUES(completed_at)),completed_at)`,
        [
          req.analyticsUser,
          v.clientId,
          v.challengeId,
          sqlDate(started),
          completed ? sqlDate(completed) : null,
        ],
      );
      const [saved] = await pool.query(
        "SELECT challenge_id,started_at FROM challenge_attempts WHERE user_id=? AND client_id=?",
        [req.analyticsUser, v.clientId],
      );
      if (
        saved[0].challenge_id !== v.challengeId ||
        +new Date(saved[0].started_at) !== +started
      )
        return reply
          .code(409)
          .send({ error: "Identificator folosit pentru altă provocare." });
      return { ok: true };
    },
  );
}
