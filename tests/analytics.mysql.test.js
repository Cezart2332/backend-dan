import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { loadAnalytics, registerAnalyticsRoutes } from "../src/analytics.js";
import { recordRevenueEvent } from "../src/revenue-ledger.js";

const uri = process.env.ANALYTICS_TEST_MYSQL_URL;
test(
  "analytics SQL, import, access and deduplication on an isolated MySQL database",
  { skip: !uri },
  async (t) => {
    const url = new URL(uri);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/dan_analytics");
    process.env.DATABASE_URL = uri;
    const { mysqlPool: pool } = await import("../src/mysql.js");
    t.after(() => pool.end());
    const { runMigrations } = await import("../src/migrate.js");
    await runMigrations();
    await runMigrations();
    for (const table of [
      "revenue_transactions",
      "revenue_events",
      "questions",
      "bug_reports",
      "meetings",
      "users",
    ])
      await pool.query(`DELETE FROM ${table}`);
    const now = new Date(),
      today = now.toISOString().slice(0, 10),
      day = (offset) =>
        new Date(+now + offset * 86400000).toISOString().slice(0, 10),
      sql = (offset) => `${day(offset)} 12:00:00`;
    await pool.query(
      "INSERT INTO users (id,email,name,created_at) VALUES (1,'one@example.invalid','Cont de test',?),(2,'two@example.invalid','Trial',?),(3,'three@example.invalid','Expirat',?)",
      [sql(-40), sql(-20), sql(-10)],
    );
    await pool.query(
      "INSERT INTO subscriptions (user_id,type,starts_at,ends_at) VALUES (1,'trial',?,?),(1,'basic',?,?),(1,'pro',?,?),(1,'vip',?,?),(2,'trial',?,?),(3,'premium',?,?)",
      [
        sql(-9),
        sql(2),
        sql(-8),
        sql(3),
        sql(-7),
        sql(4),
        sql(1),
        sql(9),
        sql(-9),
        sql(2),
        sql(-20),
        sql(-1),
      ],
    );
    const query = { from: day(-6), to: today, currency: "USD" };
    const base = {
      type: "INITIAL_PURCHASE",
      event_timestamp_ms: Date.parse(`${day(-3)}T12:00:00Z`),
      transaction_id: "apple-tx",
      product_id: "dan_pro",
      store: "APP_STORE",
      environment: "PRODUCTION",
      currency: "RON",
      price: 10,
      price_in_purchased_currency: 45,
    };
    await recordRevenueEvent(pool, { ...base, id: "purchase" }, 1);
    await recordRevenueEvent(pool, { ...base, id: "purchase" }, 1);
    await recordRevenueEvent(pool, { ...base, id: "purchase-retry" }, 1);
    await recordRevenueEvent(
      pool,
      {
        ...base,
        id: "sandbox",
        transaction_id: "sandbox",
        environment: "SANDBOX",
        price: 999,
      },
      1,
    );
    await recordRevenueEvent(
      pool,
      {
        ...base,
        id: "trial",
        transaction_id: "trial",
        period_type: "TRIAL",
        price: 0,
      },
      2,
    );
    await recordRevenueEvent(
      pool,
      {
        ...base,
        id: "refund",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: Date.parse(`${day(-2)}T12:00:00Z`),
        price: -2,
        price_in_purchased_currency: -9,
      },
      1,
    );
    await pool.query(
      "INSERT INTO audio_activity (user_id,client_id,media_key,listened_ms,duration_ms,completed,occurred_at) VALUES (1,UUID(),'about_dan_intro.mp4',120000,120000,1,?),(1,UUID(),'about_dan_intro.mp4',60000,120000,0,?)",
      [sql(-2), sql(-1)],
    );
    await pool.query(
      "INSERT INTO wellbeing_sessions (user_id,client_id,occurred_at,payload) VALUES (1,UUID(),?,?)",
      [
        sql(-2),
        JSON.stringify({
          status: "completed",
          techniques: ["breathing", "grounding"],
          feedback: { rating: "helpful" },
        }),
      ],
    );
    await pool.query(
      "INSERT INTO challenge_runs (user_id,challenge_id,difficulty,client_date) VALUES (1,'l1_c2',3,?)",
      [sql(-1)],
    );
    await pool.query(
      "INSERT INTO questions (user_id,question,created_at,responded_at,admin_response,status) VALUES (1,'Întrebare de test',?,DATE_ADD(?,INTERVAL 2 HOUR),'Răspuns','answered'),(1,'În așteptare',?,NULL,NULL,'new')",
      [sql(-2), sql(-2), sql(-1)],
    );
    const d = await loadAnalytics(pool, query);
    assert.equal(d.subscriptions.active, 1);
    assert.deepEqual(
      d.subscriptions.byPlan.find((p) => p.plan === "pro"),
      { plan: "pro", total: 1 },
    );
    assert.equal(d.subscriptions.activeTrials, 1);
    assert.equal(d.revenue.gross, 10);
    assert.equal(d.revenue.refunds, 2);
    assert.equal(d.revenue.net, 8);
    assert.equal(d.revenue.payments, 1);
    assert.equal(d.revenue.series.length, 7);
    assert.equal(d.videos.minutes, 3);
    assert.equal(d.videos.completionRate, 50);
    assert.equal(d.videos.top[0].title, "Intro");
    assert.equal(d.sos.helpful, 1);
    assert.equal(d.sos.grounding, 1);
    assert.equal(d.dan.replyHours, 2);
    assert.equal(
      (await loadAnalytics(pool, { ...query, currency: "RON" })).revenue.net,
      36,
    );
    const app = Fastify();
    t.after(() => app.close());
    const secret = "local-analytics-test";
    process.env.JWT_SECRET = secret;
    process.env.REVENUECAT_WEBHOOK_AUTH = "local-webhook-test";
    const { registerSubscriptionRoutes } =
      await import("../src/routes-subscriptions.js");
    await registerSubscriptionRoutes(app);
    await registerAnalyticsRoutes(app, {
      pool,
      jwtSecret: secret,
      adminAuth: async (req) => req.headers["x-admin-token"] === "local-test",
    });
    const admin = { "x-admin-token": "local-test" },
      user = { authorization: `Bearer ${jwt.sign({ sub: 1 }, secret)}` };
    for (const path of ["/api/admin/analytics", "/api/admin/subscriptions"])
      assert.equal((await app.inject({ url: path })).statusCode, 403);
    assert.equal(
      (
        await app.inject({
          url: "/api/admin/analytics?from=invalid",
          headers: admin,
        })
      ).statusCode,
      400,
    );
    const subs = (
      await app.inject({
        url: "/api/admin/subscriptions?limit=1",
        headers: admin,
      })
    ).json();
    assert.equal(subs.total, 1);
    assert.equal(subs.items[0].type, "pro");
    assert.equal(
      (
        await app.inject({
          url: "/api/admin/subscriptions?plan=trial",
          headers: admin,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/activity/visit",
          payload: { day: today, platform: "ios" },
        })
      ).statusCode,
      401,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/activity/visit",
            headers: user,
            payload: { day: today, platform: "ios" },
          })
        ).statusCode,
        200,
      );
    const attempt = {
      clientId: "12345678-1234-4234-9234-123456789012",
      challengeId: "l1_c2",
      startedAt: new Date(Date.now() - 5000).toISOString(),
    };
    for (const payload of [
      attempt,
      { ...attempt, completedAt: new Date().toISOString() },
      attempt,
    ])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/activity/challenge",
            headers: user,
            payload,
          })
        ).statusCode,
        200,
      );
    const activity = await loadAnalytics(pool, query);
    assert.equal(activity.users.activeUsers, 1);
    assert.equal(activity.challenges.started, 1);
    assert.equal(activity.challenges.attemptsCompleted, 1);
    assert.equal(activity.challenges.completionRate, 100);
    const csv = `rc_original_app_user_id,store_transaction_id,product_identifier,store,start_time,updated_at,is_sandbox,is_trial_period,purchased_currency,purchase_price_in_usd,price_in_usd,purchase_price_in_purchased_currency,price_in_purchased_currency,refunded_at,renewal_number\n1,apple-tx,dan_pro,app_store,${sql(-3)},${sql(-2)},false,false,RON,10,8,45,36,${sql(-2)},1`;
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/admin/analytics/import",
            headers: admin,
            payload: { csv },
          })
        ).statusCode,
        200,
      );
    const imported = await loadAnalytics(pool, query);
    assert.equal(imported.revenue.net, 8);
    assert.equal(imported.revenue.payments, 1);
    assert.equal(imported.subscriptions.renewals, 0);
    await recordRevenueEvent(
      pool,
      {
        ...base,
        id: "reversed",
        type: "REFUND_REVERSED",
        event_timestamp_ms: Date.parse(`${day(-1)}T12:00:00Z`),
      },
      1,
    );
    await recordRevenueEvent(
      pool,
      {
        ...base,
        id: "refund",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        event_timestamp_ms: Date.parse(`${day(-2)}T12:00:00Z`),
        price: -2,
        price_in_purchased_currency: -9,
      },
      1,
    );
    assert.equal((await loadAnalytics(pool, query)).revenue.net, 10);
    await pool.query("DELETE FROM users WHERE id=1");
    const [[left]] = await pool.query(
      "SELECT COUNT(*) AS total FROM app_activity_days",
    );
    assert.equal(left.total, 0);
    assert.equal((await loadAnalytics(pool, query)).revenue.net, 10);
    const webhook = async (event) =>
      app.inject({
        method: "POST",
        url: "/api/subscriptions/webhook",
        headers: { "x-revenuecat-auth": "local-webhook-test" },
        payload: { event },
      });
    const native = {
      ...base,
      app_user_id: "3",
      purchased_at_ms: Date.parse(`${day(-3)}T12:00:00Z`),
      expiration_at_ms: Date.parse(`${day(10)}T12:00:00Z`),
      product_id: "dan_basic",
      price: 5,
      price_in_purchased_currency: 5,
      currency: "USD",
      transaction_id: "new-basic",
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/subscriptions/webhook",
          payload: { event: { ...native, id: "bad-auth" } },
        })
      ).statusCode,
      401,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await webhook({ ...native, id: "native-purchase" })).statusCode,
        200,
      );
    const [[recordCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM subscriptions WHERE user_id=3 AND revenuecat_product_id='dan_basic'",
    );
    assert.equal(recordCount.total, 1);
    await webhook({
      ...native,
      id: "older-expiration",
      type: "EXPIRATION",
      event_timestamp_ms: Date.parse(`${day(-4)}T12:00:00Z`),
      expiration_at_ms: Date.parse(`${day(-4)}T12:00:00Z`),
    });
    await webhook({
      ...native,
      id: "cancel-renewal",
      type: "CANCELLATION",
      cancel_reason: "UNSUBSCRIBE",
      event_timestamp_ms: Date.now(),
    });
    const current = await loadAnalytics(pool, query);
    assert.equal(current.subscriptions.active, 1);
    const [renewal] = await pool.query(
      "SELECT revenuecat_will_renew FROM subscriptions WHERE user_id=3 AND revenuecat_product_id='dan_basic'",
    );
    assert.equal(renewal[0].revenuecat_will_renew, 0);
    await webhook({
      ...native,
      id: "sandbox-access",
      environment: "SANDBOX",
      app_user_id: "2",
      product_id: "dan_pro",
    });
    const [sandbox] = await pool.query(
      "SELECT id FROM subscriptions WHERE user_id=2 AND type='pro'",
    );
    assert.equal(sandbox.length, 0);
  },
);
