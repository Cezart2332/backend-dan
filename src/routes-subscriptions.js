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
  if (typeof val === 'string' && val.toLowerCase().includes('placeholder')) return null; // treat placeholders as unset
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
      // Log early request body for diagnostics (priceId may still be a placeholder in frontend code)
      request.log.info({ body: request.body }, 'Incoming create-checkout payload');

      // Resolve price ID (explicit overrides plan mapping)
      const finalPriceId = await resolvePriceId(normPlan, rawPriceId);
      if (!normPlan) return reply.code(400).send({ error: 'Plan lipsă', code: 'PLAN_REQUIRED' });
      const rawMapValue = priceMap[normPlan];
      if (rawMapValue && rawMapValue.toLowerCase().includes('placeholder')) {
        return reply.code(400).send({
          error: 'Valoare placeholder în env pentru acest plan – setează un ID real de produs (prod_...) sau preț (price_...)',
          code: 'PLACEHOLDER_PRICE_ID',
          plan: normPlan,
          source: 'env',
          rawMapValue,
        });
      }
      if (!finalPriceId) {
        return reply.code(400).send({
          error: 'Preț inexistent pentru plan / produs sau priceId invalid',
          code: rawMapValue && rawMapValue.startsWith('prod_') ? 'PRODUCT_PRICE_NOT_FOUND' : 'PRICE_NOT_FOUND',
          plan: normPlan,
        });
      }
      if (finalPriceId.toLowerCase().includes('placeholder')) {
        return reply.code(400).send({
          error: 'ID-ul de preț este încă un placeholder – actualizează mediul și redepornește containerul',
          code: 'PLACEHOLDER_PRICE_ID',
          price: finalPriceId,
          source: rawPriceId && rawPriceId.toLowerCase().includes('placeholder') ? 'explicit-request' : 'resolved',
          rawPriceId: rawPriceId || null,
          mapValue: rawMapValue || null,
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

      // Optional pre-validation of price to surface clearer errors (enabled by env STRIPE_VALIDATE_PRICE=1)
      if (process.env.STRIPE_VALIDATE_PRICE === '1') {
        try {
          const priceObj = await stripe.prices.retrieve(finalPriceId);
          if (mode === 'subscription' && !priceObj.recurring) {
            return reply.code(400).send({
              error: 'Prețul nu este de tip abonament (recurring) pentru mode=subscription',
              code: 'PRICE_NOT_RECURRING',
              price: finalPriceId,
            });
          }
        } catch (err) {
          request.log.error({ err, price: finalPriceId }, 'Price retrieval failed');
          return reply.code(400).send({
            error: 'Prețul nu a putut fi găsit în Stripe (verifică dacă faci test vs live)',
            code: 'PRICE_LOOKUP_FAILED',
            price: finalPriceId,
          });
        }
      }

      // Build line items for session
      const lineItems = [{ price: finalPriceId, quantity: Number(quantity) > 0 ? Number(quantity) : 1 }];

      request.log.info({ plan: normPlan, finalPriceId, mode, rawMapValue }, 'Preparing checkout session');

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
        subscription_data: { metadata: { userId: String(user.sub), plan: normPlan } },
        success_url: `${successBase}/?checkout=success&plan=${encodeURIComponent(plan)}`,
        cancel_url: `${successBase}/?checkout=cancel&plan=${encodeURIComponent(plan)}`,
        metadata: { userId: String(user.sub), plan: normPlan },
      });
      reply.send({ url: session.url });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      // Stripe price missing -> 400 with clearer code
      if (e && e.code === 'resource_missing' && e.param === 'line_items[0][price]') {
        return reply.code(400).send({
          error: 'Preț Stripe inexistent (posibil test vs live mismatch sau ID greșit)',
          code: 'STRIPE_PRICE_MISSING',
          param: e.param,
          hint: 'Verifică dacă folosești cheia sk_test cu un price_ test și nu amesteci cu live',
        });
      }
      console.error('[checkout] error', e);
      reply.code(500).send({ error: 'Eroare creare sesiune checkout', code: 'CHECKOUT_FAILED' });
    }
  });

  // In-app PaymentSheet subscription setup (returns ephemeral key + payment intent client secret)
  app.post('/api/subscriptions/create-payment-sheet', async (request, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: 'Stripe neconfigurat', code: 'STRIPE_NOT_CONFIGURED' });
      const user = requireAuth(request);
      const { plan, priceId: explicitPriceId } = request.body || {};
      const normPlan = typeof plan === 'string' ? plan.toLowerCase().trim() : '';
      if (!normPlan) return reply.code(400).send({ error: 'Plan lipsă', code: 'PLAN_REQUIRED' });
      const rawMapValue = priceMap[normPlan];
      if (rawMapValue && rawMapValue.toLowerCase().includes('placeholder')) {
        return reply.code(400).send({ error: 'Valoare placeholder în env pentru acest plan', code: 'PLACEHOLDER_PRICE_ID', plan: normPlan });
      }
      const finalPriceId = await resolvePriceId(normPlan, explicitPriceId);
      if (!finalPriceId) return reply.code(400).send({ error: 'Preț inexistent pentru plan', code: 'PRICE_NOT_FOUND', plan: normPlan });
      if (finalPriceId.toLowerCase().includes('placeholder')) return reply.code(400).send({ error: 'ID placeholder', code: 'PLACEHOLDER_PRICE_ID' });

      // Reuse existing customer if available
      let customerId;
      const [existing] = await mysqlPool.query(
        `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND stripe_customer_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
        [user.sub]
      );
      if (Array.isArray(existing) && existing.length && existing[0].stripe_customer_id) {
        customerId = existing[0].stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user.sub) } });
        customerId = customer.id;
      }

      // Create ephemeral key for PaymentSheet (client uses publishable key + this secret)
      const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2024-06-20' });

      // Create subscription in incomplete state until payment is confirmed in PaymentSheet
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: finalPriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId: String(user.sub), plan: normPlan },
      });

      const latestInvoice = subscription.latest_invoice;
      const paymentIntent = latestInvoice && latestInvoice.payment_intent;
      if (!paymentIntent) {
        return reply.code(500).send({ error: 'PaymentIntent lipsă în subscription', code: 'MISSING_PAYMENT_INTENT' });
      }

      reply.send({
        customerId,
        ephemeralKeySecret: ephemeralKey.secret,
        paymentIntentClientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        priceId: finalPriceId,
        plan: normPlan,
      });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      request.log.error({ err: e }, 'create-payment-sheet failed');
      reply.code(500).send({ error: 'Eroare creare PaymentSheet subscription', code: 'PAYMENTSHEET_SUB_CREATE_FAILED', message: e.message });
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

  // Inspect a single plan with deeper Stripe data (does NOT expose secrets)
  app.get('/api/subscriptions/inspect', async (request, reply) => {
    if (!stripe) return reply.code(500).send({ error: 'Stripe neconfigurat', code: 'STRIPE_NOT_CONFIGURED' });
    const plan = (request.query.plan || '').toLowerCase();
    if (!plan) return reply.code(400).send({ error: 'Parametru plan lipsă', code: 'PLAN_REQUIRED' });
    const source = priceMap[plan];
    if (!source) return reply.code(404).send({ error: 'Plan fără configurare', code: 'PLAN_NOT_CONFIGURED' });
    const detail = { plan, source, type: null, resolvedPriceId: null, stripe: {}, notes: [] };
    try {
      if (source.startsWith('price_')) {
        detail.type = 'price';
        const priceObj = await stripe.prices.retrieve(source);
        detail.resolvedPriceId = priceObj.id;
        detail.stripe.price = {
          id: priceObj.id,
          active: priceObj.active,
          currency: priceObj.currency,
          unit_amount: priceObj.unit_amount,
          recurring: priceObj.recurring || null,
          product: priceObj.product,
        };
      } else if (source.startsWith('prod_')) {
        detail.type = 'product';
        const product = await stripe.products.retrieve(source);
        detail.stripe.product = { id: product.id, name: product.name, active: product.active, default_price: product.default_price || null };
        const priceId = await resolvePriceId(plan, null);
        detail.resolvedPriceId = priceId;
        if (priceId) {
          const priceObj = await stripe.prices.retrieve(priceId);
            detail.stripe.price = {
              id: priceObj.id,
              active: priceObj.active,
              currency: priceObj.currency,
              unit_amount: priceObj.unit_amount,
              recurring: priceObj.recurring || null,
            };
        } else {
          const prices = await stripe.prices.list({ product: source, active: true, limit: 5 });
          detail.stripe.availablePrices = prices.data.map(p => ({ id: p.id, recurring: p.recurring || null, active: p.active, unit_amount: p.unit_amount }));
          detail.notes.push('No default price resolved; see availablePrices');
        }
      } else {
        detail.type = 'unknown';
        detail.notes.push('Source value must start with price_ or prod_');
      }
      reply.send(detail);
    } catch (err) {
      reply.code(500).send({ error: 'Inspect failure', code: 'INSPECT_ERROR', message: err.message });
    }
  });

  // Clear cached product->price resolutions
  app.post('/api/subscriptions/refresh-price-cache', async (_request, reply) => {
    const size = productDefaultPriceCache.size;
    productDefaultPriceCache.clear();
    reply.send({ cleared: size });
  });

  // Comprehensive debug endpoint for all plan price/product data
  app.get('/api/subscriptions/debug/prices', async (request, reply) => {
    if (!stripe) return reply.code(500).send({ error: 'Stripe neconfigurat', code: 'STRIPE_NOT_CONFIGURED' });
    const includeRaw = request.query && (request.query.full === '1' || request.query.full === 'true');
    const envMode = stripeSecret.includes('_test_') || stripeSecret.startsWith('sk_test') ? 'test' : 'live';
    const plans = Object.keys(priceMap);
    const result = { envMode, plans: {} };
    for (const plan of plans) {
      const entry = { source: priceMap[plan] || null, resolution: null, resolvedPriceId: null, product: null, price: null, error: null, notes: [] };
      const source = entry.source;
      if (!source) {
        entry.error = 'NO_SOURCE';
        result.plans[plan] = entry;
        continue;
      }
      try {
        if (source.startsWith('price_')) {
            entry.resolution = 'direct-price';
            entry.resolvedPriceId = source;
            const p = await stripe.prices.retrieve(source);
            entry.price = {
              id: p.id,
              active: p.active,
              currency: p.currency,
              unit_amount: p.unit_amount,
              recurring: p.recurring || null,
              product: typeof p.product === 'string' ? p.product : p.product?.id,
            };
            if (includeRaw) entry.priceRaw = p;
            if (typeof p.product === 'string') {
              try {
                const prod = await stripe.products.retrieve(p.product);
                entry.product = { id: prod.id, name: prod.name, active: prod.active, default_price: prod.default_price || null };
                if (includeRaw) entry.productRaw = prod;
              } catch (err) {
                entry.notes.push('Failed to retrieve product for price');
              }
            }
        } else if (source.startsWith('prod_')) {
            entry.resolution = 'product->price';
            const prod = await stripe.products.retrieve(source);
            entry.product = { id: prod.id, name: prod.name, active: prod.active, default_price: prod.default_price || null };
            if (includeRaw) entry.productRaw = prod;
            const resolved = await resolvePriceId(plan, null);
            entry.resolvedPriceId = resolved;
            if (resolved) {
              const p = await stripe.prices.retrieve(resolved);
              entry.price = {
                id: p.id,
                active: p.active,
                currency: p.currency,
                unit_amount: p.unit_amount,
                recurring: p.recurring || null,
                product: typeof p.product === 'string' ? p.product : p.product?.id,
              };
              if (includeRaw) entry.priceRaw = p;
            } else {
              entry.error = 'NO_RESOLVED_PRICE';
              const fallbackList = await stripe.prices.list({ product: source, active: true, limit: 5 });
              entry.availablePrices = fallbackList.data.map(pp => ({ id: pp.id, recurring: pp.recurring || null, active: pp.active, unit_amount: pp.unit_amount }));
            }
        } else {
          entry.error = 'UNSUPPORTED_SOURCE_FORMAT';
        }
      } catch (err) {
        entry.error = 'LOOKUP_FAILED';
        entry.notes.push(err.message);
      }
      result.plans[plan] = entry;
    }
    reply.send(result);
  });

  // Debug: fetch raw Stripe subscription (limited fields) for current user
  app.get('/api/subscriptions/stripe/raw/:id', async (request, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: 'Stripe neconfigurat', code: 'STRIPE_NOT_CONFIGURED' });
      const user = requireAuth(request);
      const subId = request.params.id;
      if (!subId || !subId.startsWith('sub_')) return reply.code(400).send({ error: 'ID invalid', code: 'BAD_SUB_ID' });
      // Verify ownership via local DB
      const [rows] = await mysqlPool.query(
        'SELECT * FROM subscriptions WHERE user_id = ? AND stripe_subscription_id = ? ORDER BY id DESC LIMIT 1',
        [user.sub, subId]
      );
      if (!Array.isArray(rows) || !rows.length) return reply.code(404).send({ error: 'Subscription not found', code: 'NOT_FOUND' });
      const stripeSub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice.payment_intent', 'pending_update'] });
      const out = {
        id: stripeSub.id,
        status: stripeSub.status,
        planPriceId: stripeSub.items?.data?.[0]?.price?.id || null,
        current_period_start: stripeSub.current_period_start,
        current_period_end: stripeSub.current_period_end,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        canceled_at: stripeSub.canceled_at,
        latest_invoice_amount: stripeSub.latest_invoice && typeof stripeSub.latest_invoice === 'object' ? stripeSub.latest_invoice.amount_paid : null,
        latest_invoice_status: stripeSub.latest_invoice && typeof stripeSub.latest_invoice === 'object' ? stripeSub.latest_invoice.status : null,
        collection_method: stripeSub.collection_method,
        default_payment_method: stripeSub.default_payment_method && typeof stripeSub.default_payment_method === 'object' ? {
          id: stripeSub.default_payment_method.id,
          type: stripeSub.default_payment_method.type,
          card: stripeSub.default_payment_method.card ? { brand: stripeSub.default_payment_method.card.brand, last4: stripeSub.default_payment_method.card.last4 } : null,
        } : null,
      };
      reply.send(out);
    } catch (err) {
      request.log.error({ err }, 'Stripe subscription debug fetch failed');
      reply.code(500).send({ error: 'Debug fetch failed', code: 'STRIPE_SUB_DEBUG_FAILED' });
    }
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
          const userId = subObj.metadata?.userId; // ensured via subscription_data.metadata
          if (userId) {
            const stripeStatus = subObj.status; // active, trialing, canceled, incomplete, past_due ...
            const priceId = subObj.items?.data?.[0]?.price?.id;
            // Prefer explicit plan metadata; fallback to pattern heuristic & status
            let localType = (subObj.metadata?.plan || '').toLowerCase();
            if (!['basic','premium','vip','trial'].includes(localType)) {
              if (priceId?.includes('basic')) localType = 'basic';
              else if (priceId?.includes('vip')) localType = 'vip';
              else if (stripeStatus === 'trialing') localType = 'trial';
              else localType = 'premium';
            }
            const periodStart = subObj.current_period_start ? new Date(subObj.current_period_start * 1000) : new Date();
            const periodEnd = subObj.current_period_end ? new Date(subObj.current_period_end * 1000) : null;

            // Fetch latest row for this subscription (if any)
            const [rows] = await mysqlPool.query(
              `SELECT * FROM subscriptions WHERE user_id = ? AND stripe_subscription_id = ? ORDER BY id DESC LIMIT 1`,
              [userId, subObj.id]
            );
            const existing = Array.isArray(rows) && rows.length ? rows[0] : null;

            if (!existing) {
              // First time we see this subscription -> insert with explicit periodStart
              await mysqlPool.query(
                `INSERT INTO subscriptions (user_id, type, starts_at, ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, localType, periodStart, periodEnd, subObj.customer, subObj.id, priceId]
              );
            } else {
              // If still same billing period (starts_at within 2 minutes of new periodStart) just update fields
              const existingStart = existing.starts_at ? new Date(existing.starts_at) : null;
              const samePeriod = existingStart && Math.abs(existingStart.getTime() - periodStart.getTime()) < 120000; // 2 min tolerance
              if (samePeriod) {
                await mysqlPool.query(
                  `UPDATE subscriptions SET type = ?, ends_at = ?, stripe_price_id = ? WHERE id = ?`,
                  [localType, periodEnd, priceId, existing.id]
                );
              } else if (periodStart > existingStart) {
                // New billing period began -> close previous (if not closed) and insert new period row
                if (!existing.ends_at || new Date(existing.ends_at).getTime() < periodStart.getTime()) {
                  await mysqlPool.query(`UPDATE subscriptions SET ends_at = ? WHERE id = ?`, [periodStart, existing.id]);
                }
                await mysqlPool.query(
                  `INSERT INTO subscriptions (user_id, type, starts_at, ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [userId, localType, periodStart, periodEnd, subObj.customer, subObj.id, priceId]
                );
              } else {
                // Edge case: out-of-order event with earlier start -> ignore
              }
            }
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
