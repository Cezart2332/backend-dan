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
  const secret = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
  if (!secret) throw new Error('SERVER_CONFIG_ERROR');
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
      let sub = await getActiveSubscription(user.sub);
      // Auto fallback: if no active sub and user had an expired trial, morph to basic (one-time) unless already has a paid/basic entry
      if (!sub) {
        const [trialRows] = await mysqlPool.query(
          `SELECT * FROM subscriptions WHERE user_id = ? AND type = 'trial' ORDER BY ends_at DESC LIMIT 1`,
          [user.sub]
        );
        const lastTrial = Array.isArray(trialRows) && trialRows.length ? trialRows[0] : null;
        if (lastTrial && lastTrial.ends_at && new Date(lastTrial.ends_at).getTime() < Date.now()) {
          // Check if any non-trial subscription already exists after trial end
          const [postRows] = await mysqlPool.query(
            `SELECT id FROM subscriptions WHERE user_id = ? AND type IN ('basic','premium','vip') AND starts_at > ? LIMIT 1`,
            [user.sub, lastTrial.ends_at]
          );
            if (!Array.isArray(postRows) || !postRows.length) {
              // Create a perpetual basic access row (ends_at NULL) as fallback
              await mysqlPool.query(
                `INSERT INTO subscriptions (user_id, type, starts_at, ends_at) VALUES (?, 'basic', NOW(), NULL)`,
                [user.sub]
              );
              request.log.info({ userId: user.sub, source: 'auto-basic-fallback' }, '[subscriptions] inserted fallback basic subscription');
              sub = await getActiveSubscription(user.sub);
            }
        }
      }
      let status = 'none';
      if (sub) {
        const now = Date.now();
        const ends = sub.ends_at ? new Date(sub.ends_at).getTime() : null;
        if (!ends || ends > now) status = 'active';
        else status = 'expired';
      }
      // Check if user is eligible for trial (never had a trial before)
      const [pastTrials] = await mysqlPool.query(
        `SELECT id FROM subscriptions WHERE user_id = ? AND type = 'trial' LIMIT 1`,
        [user.sub]
      );
      const trialEligible = !Array.isArray(pastTrials) || pastTrials.length === 0;
      reply.send({ subscription: sub || null, status, trialEligible });
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
      // If user already has any active subscription (trial or paid) do not grant new trial
      const active = await getActiveSubscription(user.sub);
      if (active) return reply.send({ subscription: active, note: 'Subscription already active' });

      // Enforce one-time trial: check if user ever had a trial row before
      const [pastTrials] = await mysqlPool.query(
        `SELECT id FROM subscriptions WHERE user_id = ? AND type = 'trial' LIMIT 1`,
        [user.sub]
      );
      if (Array.isArray(pastTrials) && pastTrials.length) {
        return reply.code(400).send({ error: 'Trial deja folosit', code: 'TRIAL_ALREADY_USED' });
      }
      // Grant a 3-day Basic-equivalent trial (type=trial)
      await mysqlPool.query(
        `INSERT INTO subscriptions (user_id, type, starts_at, ends_at) VALUES (?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY))`,
        [user.sub]
      );
      request.log.info({ userId: user.sub, durationDays: 3 }, '[subscriptions] inserted trial subscription');
      const created = await getActiveSubscription(user.sub);
      reply.send({ subscription: created, note: 'Trial started' });
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

      request.log.info({ plan: normPlan, mode }, 'Preparing checkout session');

      const successBase = process.env.CLIENT_ORIGIN || 'http://localhost:19006';

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
      request.log.error({ err: e }, '[checkout] error');
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

  // History endpoint – all subscription rows for the user (limited to last 50)
  app.get('/api/subscriptions/history', async (request, reply) => {
    try {
      const user = requireAuth(request);
      const [rows] = await mysqlPool.query(
        `SELECT id, type, starts_at, ends_at, stripe_subscription_id, stripe_price_id, created_at, updated_at
         FROM subscriptions WHERE user_id = ? ORDER BY starts_at DESC LIMIT 50`,
        [user.sub]
      );
      reply.send({ history: rows });
    } catch (e) {
      if (e.message === 'NO_AUTH' || e.message === 'BAD_TOKEN') return reply.code(401).send({ error: 'Neautorizat' });
      reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // Webhook with signature verification & subscription sync
  app.post('/api/subscriptions/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Require webhook secret in production
    if (!webhookSecret) {
      request.log.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook not configured' });
    }
    if (!stripe) {
      return reply.code(500).send({ error: 'Stripe not configured' });
    }
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
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
              request.log.info({ userId, type: localType, stripe_subscription_id: subObj.id }, '[subscriptions] webhook insert new subscription');
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
                request.log.info({ userId, type: localType, stripe_subscription_id: subObj.id }, '[subscriptions] webhook insert new billing period');
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
        case 'invoice.payment_succeeded': {
          // Backfill ends_at for current period if we inserted row before initial payment (ends_at may still be NULL)
          const invoice = event.data.object;
          const subId = invoice.subscription;
          if (stripe && subId && typeof subId === 'string' && subId.startsWith('sub_')) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(subId);
              const userId = stripeSub.metadata?.userId;
              if (userId) {
                const periodEnd = stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null;
                if (periodEnd) {
                  // Update latest row for this subscription if ends_at is still null
                  await mysqlPool.query(
                    `UPDATE subscriptions SET ends_at = ? WHERE user_id = ? AND stripe_subscription_id = ? AND (ends_at IS NULL OR ends_at < ?)`,
                    [periodEnd, userId, subId, periodEnd]
                  );
                }
              }
            } catch (err) {
              request.log.error({ err, subId }, 'Failed to backfill ends_at on invoice.payment_succeeded');
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subId = invoice.subscription;
          if (stripe && subId && typeof subId === 'string') {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(subId);
              const userId = stripeSub.metadata?.userId;
              if (userId) {
                // Mark current active row as at-risk (ends_at unchanged) – optional: could add a flag column; for now we just log
                request.log.warn({ subId, userId }, 'Payment failed for subscription');
              }
            } catch (err) {
              request.log.error({ err, subId }, 'Failed to process payment_failed');
            }
          }
          break;
        }
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
