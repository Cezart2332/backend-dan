import Stripe from 'stripe';
import { mysqlPool } from './mysql.js';
import jwt from 'jsonwebtoken';

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' }) : null;

// Price / Product mapping via env (frontend supplies a logical plan)
// Values can be either a Stripe Price ID (price_...) or a Product ID (prod_...).
const priceMap = {
  basic: process.env.SUBSCRIPTION_PRICE_BASIC,
  premium: process.env.SUBSCRIPTION_PRICE_PREMIUM,
  vip: process.env.SUBSCRIPTION_PRICE_VIP,
};

// Simple in-memory cache for product -> default price resolution
const productDefaultPriceCache = new Map();

async function resolvePriceId(plan, explicit) {
  if (explicit) return explicit; // override wins
  if (!plan) return null;
  const val = priceMap[plan];
  if (!val) return null;
  // If it's already a price id, return directly
  if (val.startsWith('price_')) return val;
  // If it's a product id, try to resolve its default price
  if (val.startsWith('prod_')) {
    if (!stripe) return null; // cannot resolve without Stripe client
    if (productDefaultPriceCache.has(val)) return productDefaultPriceCache.get(val);
    try {
      const product = await stripe.products.retrieve(val);
      let priceId = product.default_price && typeof product.default_price === 'string'
        ? product.default_price
        : (typeof product.default_price === 'object' && product.default_price?.id) ? product.default_price.id : null;
      if (!priceId) {
        // Fallback: list one active price
        const prices = await stripe.prices.list({ product: val, active: true, limit: 1 });
        if (prices.data.length) priceId = prices.data[0].id;
      }
      if (priceId) {
        productDefaultPriceCache.set(val, priceId);
        return priceId;
      }
      return null;
    } catch (err) {
      return null;
    }
  }
  return null; // unsupported format
}

function requireAuth(request) {
  const auth = request.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('NO_AUTH');
  const secret = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || 'dev_change_me';
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch {
    throw new Error('BAD_TOKEN');
  }
}

async function getActiveSubscription(userId) {
  const [rows] = await mysqlPool.query(
    `SELECT * FROM subscriptions WHERE user_id = ? AND (ends_at IS NULL OR ends_at > NOW()) ORDER BY starts_at DESC LIMIT 1`,
    [userId]
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function registerSubscriptionRoutes(app) {
  // Get current subscription (including trial)
  app.get('/api/subscriptions/current', async (request, reply) => {
    try {
      const user = requireAuth(request);
      const sub = await getActiveSubscription(user.sub);
      let status = 'none';
      if (sub) {
        const now = Date.now();
        const ends = sub.ends_at ? new Date(sub.ends_at).getTime() : null;
        if (!ends || ends > now) status = 'active';
        else status = 'expired';
      }
      reply.send({ subscription: sub || null, status });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      request.log.error(e);
      reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Start or ensure a trial (client can call on signup or dashboard)
  app.post('/api/subscriptions/start-trial', async (request, reply) => {
    try {
      const user = requireAuth(request);
      const existing = await getActiveSubscription(user.sub);
      if (existing) return reply.send({ subscription: existing, note: 'Subscription already active' });
      // 3 day trial
      await mysqlPool.query(
        `INSERT INTO subscriptions (user_id, type, starts_at, ends_at) VALUES (?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY))`,
        [user.sub]
      );
      const created = await getActiveSubscription(user.sub);
      reply.send({ subscription: created });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      request.log.error(e);
      reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Create checkout session (Stripe Hosted) - placeholder until product/price IDs configured
  app.post('/api/subscriptions/create-checkout', async (request, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: 'Stripe neconfigurat', code: 'STRIPE_NOT_CONFIGURED' });
      const user = requireAuth(request);
      const { plan, mode = 'subscription', priceId: rawPriceId, quantity = 1 } = request.body || {};
      const normPlan = typeof plan === 'string' ? plan.toLowerCase().trim() : '';

      // Resolve price ID (explicit overrides plan mapping)
      const finalPriceId = await resolvePriceId(normPlan, rawPriceId);
      if (!normPlan) return reply.code(400).send({ error: 'Plan lipsă', code: 'PLAN_REQUIRED' });
      const rawMapValue = priceMap[normPlan];
      if (!finalPriceId) {
        return reply.code(400).send({
          error: 'Preț inexistent pentru plan / produs sau priceId invalid',
          code: rawMapValue && rawMapValue.startsWith('prod_') ? 'PRODUCT_PRICE_NOT_FOUND' : 'PRICE_NOT_FOUND',
          plan: normPlan,
        });
      }
      if (!['subscription', 'payment', 'setup'].includes(mode)) {
        return reply.code(400).send({ error: 'Mode invalid', code: 'INVALID_MODE' });
      }

      // Create or reuse customer
      let customerId;
      const [existing] = await mysqlPool.query(
        `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND stripe_customer_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
        [user.sub]
      );
      if (Array.isArray(existing) && existing.length && existing[0].stripe_customer_id) {
        customerId = existing[0].stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
      }

      // Build line items
  const lineItems = [{ price: finalPriceId, quantity: Number(quantity) > 0 ? Number(quantity) : 1 }];

      const successBase = process.env.CLIENT_ORIGIN || 'http://localhost:19006';
      // Debug mode (no session creation) if ?debug=1
      if (request.query && (request.query.debug === '1' || request.query.debug === 'true')) {
        return reply.send({
          debug: true,
          plan: normPlan,
          resolvedPriceId: finalPriceId,
          sourceValue: rawMapValue || null,
          explicitPriceOverride: Boolean(rawPriceId),
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode,
        customer: customerId,
        line_items: lineItems,
        success_url: `${successBase}/?checkout=success&plan=${encodeURIComponent(plan)}`,
        cancel_url: `${successBase}/?checkout=cancel&plan=${encodeURIComponent(plan)}`,
        metadata: { userId: user.sub, plan: normPlan },
      });
      reply.send({ url: session.url });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      // Stripe price missing -> 400 with clearer code
      if (e && e.code === 'resource_missing' && e.param === 'line_items[0][price]') {
        return reply.code(400).send({ error: 'Preț Stripe inexistent', code: 'STRIPE_PRICE_MISSING', param: e.param });
      }
      console.error('[checkout] error', e);
      reply.code(500).send({ error: 'Eroare creare sesiune checkout', code: 'CHECKOUT_FAILED' });
    }
  });

  // Diagnostic endpoint to view price/product mapping & resolution
  app.get('/api/subscriptions/prices', async (request, reply) => {
    const plans = Object.keys(priceMap);
    const out = {};
    for (const p of plans) {
      const source = priceMap[p] || null;
      let resolved = null;
      let type = null;
      let ok = false;
      let reason = null;
      if (!source) {
        reason = 'no env var set';
      } else if (source.startsWith('price_')) {
        type = 'price';
        resolved = source;
        ok = true;
      } else if (source.startsWith('prod_')) {
        type = 'product';
        if (!stripe) {
          reason = 'stripe not configured';
        } else {
          resolved = await resolvePriceId(p, null);
          ok = Boolean(resolved);
          if (!ok) reason = 'could not resolve default/active price';
        }
      } else {
        type = 'unknown';
        reason = 'value not price_ or prod_';
      }
      out[p] = { source, type, resolvedPriceId: resolved, ok, reason };
    }
    reply.send({ prices: out, stripeConfigured: Boolean(stripe) });
  });

  // Webhook with signature verification & subscription sync
  app.post('/api/subscriptions/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      if (webhookSecret && stripe) {
        event = stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
      } else {
        // Fallback insecure (dev only)
        event = request.body;
      }
    } catch (err) {
      request.log.error({ err }, 'Webhook signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subObj = event.data.object;
          const userId = subObj.metadata?.userId; // we set it when creating customer or checkout metadata
          if (userId) {
            // Map Stripe status to local type & end date (simplified)
            const stripeStatus = subObj.status; // active, trialing, canceled, incomplete, past_due ...
            // Determine local type from first item price metadata or lookup (simplified fallback premium)
            const priceId = subObj.items?.data?.[0]?.price?.id;
            let localType = 'premium';
            if (priceId?.includes('basic')) localType = 'basic';
            else if (priceId?.includes('vip')) localType = 'vip';
            else if (stripeStatus === 'trialing') localType = 'trial';
            const currentPeriodEnd = subObj.current_period_end ? new Date(subObj.current_period_end * 1000) : null;
            // Upsert logic: close previous active subscription rows and insert a new row referencing stripe data
            await mysqlPool.query(
              `UPDATE subscriptions SET ends_at = NOW() WHERE user_id = ? AND (ends_at IS NULL OR ends_at > NOW())`,
              [userId]
            );
            await mysqlPool.query(
              `INSERT INTO subscriptions (user_id, type, starts_at, ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id) VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
              [userId, localType, currentPeriodEnd, subObj.customer, subObj.id, priceId]
            );
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subObj = event.data.object;
            const userId = subObj.metadata?.userId;
            if (userId) {
              await mysqlPool.query(
                `UPDATE subscriptions SET ends_at = NOW() WHERE user_id = ? AND (ends_at IS NULL OR ends_at > NOW())`,
                [userId]
              );
            }
          break;
        }
        case 'invoice.payment_succeeded':
        default:
          break;
      }
      reply.send({ received: true });
    } catch (err) {
      request.log.error({ err }, 'Webhook handling failed');
      reply.code(500).send({ error: 'Webhook processing error' });
    }
  });
}
