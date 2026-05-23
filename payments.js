import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import Stripe from 'stripe';

const PORT = Number(process.env.PAYMENTS_PORT || process.env.PORT || 4242);
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const ANNUAL_DISCOUNT_PERCENT = 10;
const DEFAULT_CURRENCY = 'eur';

const plans = {
  'client-essential': {
    name: 'Client Essentiel',
    monthlyAmount: 1900,
  },
  business: {
    name: 'Business / PME',
    monthlyAmount: 7900,
  },
  'cabinet-solo': {
    name: 'Cabinet Solo',
    monthlyAmount: 9900,
  },
  'cabinet-pro': {
    name: 'Cabinet Pro',
    monthlyAmount: 24900,
  },
};

const app = express();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeMode = stripeSecretKey?.startsWith('sk_live_') ? 'live' : 'test';
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' })
  : null;

function getAllowedOrigins() {
  const configuredOrigins = (process.env.STRIPE_ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([SITE_URL, ...configuredOrigins].map((origin) => origin.replace(/\/$/, '')));
}

const allowedOrigins = getAllowedOrigins();

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by Stripe backend CORS policy'));
  },
}));

const rateLimitBuckets = new Map();

function rateLimit(request, response, next) {
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = rateLimitBuckets.get(key) || { count: 0, resetAt: now + 60_000 };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + 60_000;
  }
  current.count += 1;
  rateLimitBuckets.set(key, current);

  if (current.count > 30) {
    response.status(429).json({ error: 'Too many checkout attempts. Please retry later.' });
    return;
  }
  next();
}

function getCheckoutAmount(plan, billingPeriod) {
  if (billingPeriod === 'yearly') {
    return Math.round(plan.monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
  }
  return plan.monthlyAmount;
}

function getBillingPeriod(value) {
  return value === 'yearly' ? 'yearly' : 'monthly';
}

function appendSessionPlaceholder(url) {
  const parsedUrl = new URL(url);
  if (!parsedUrl.searchParams.has('session_id')) {
    parsedUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  }
  return parsedUrl.toString();
}

function getSafeRedirectUrl(value, fallbackPath) {
  const fallback = new URL(fallbackPath, SITE_URL).toString();
  if (!value || typeof value !== 'string') return fallback;

  try {
    const parsedUrl = new URL(value);
    const normalizedOrigin = parsedUrl.origin.replace(/\/$/, '');
    if (!allowedOrigins.has(normalizedOrigin)) return fallback;
    return parsedUrl.toString();
  } catch {
    return fallback;
  }
}

function getCustomerEmail(value) {
  if (typeof value !== 'string') return undefined;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

app.get('/api/stripe-health', (_request, response) => {
  response.json({
    connected: Boolean(stripe),
    mode: stripe ? stripeMode : 'not_configured',
    annualDiscountPercent: ANNUAL_DISCOUNT_PERCENT,
    plans: Object.fromEntries(Object.entries(plans).map(([planId, plan]) => [
      planId,
      {
        name: plan.name,
        currency: DEFAULT_CURRENCY,
        monthlyAmount: getCheckoutAmount(plan, 'monthly'),
        yearlyAmount: getCheckoutAmount(plan, 'yearly'),
      },
    ])),
  });
});

app.post('/api/create-checkout-session', rateLimit, async (request, response) => {
  if (!stripe) {
    response.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured on the backend.' });
    return;
  }

  try {
    const { planId, billingPeriod, customerEmail, userId, successUrl, cancelUrl } = request.body || {};
    const plan = plans[String(planId || '')];
    if (!plan) {
      response.status(400).json({ error: 'Unknown or unavailable subscription plan.' });
      return;
    }

    const period = getBillingPeriod(billingPeriod);
    const unitAmount = getCheckoutAmount(plan, period);
    const success = appendSessionPlaceholder(getSafeRedirectUrl(successUrl, '/success'));
    const cancel = getSafeRedirectUrl(cancelUrl, '/cancel');
    const metadata = {
      plan_id: String(planId),
      billing_period: period,
      annual_discount_percent: period === 'yearly' ? String(ANNUAL_DISCOUNT_PERCENT) : '0',
      user_id: typeof userId === 'string' ? userId : '',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      automatic_payment_methods: { enabled: true },
      customer_email: getCustomerEmail(customerEmail),
      client_reference_id: typeof userId === 'string' ? userId : undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: DEFAULT_CURRENCY,
          unit_amount: unitAmount,
          recurring: {
            interval: period === 'yearly' ? 'year' : 'month',
          },
          product_data: {
            name: `ClairDossier - ${plan.name}`,
            metadata: {
              plan_id: String(planId),
            },
          },
        },
      }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata,
      subscription_data: { metadata },
    });

    response.json({
      id: session.id,
      url: session.url,
      mode: stripeMode,
      billingPeriod: period,
      annualDiscountPercent: period === 'yearly' ? ANNUAL_DISCOUNT_PERCENT : 0,
    });
  } catch (error) {
    console.error('Stripe checkout session error', error);
    response.status(500).json({ error: 'Unable to create Stripe Checkout session.' });
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Stripe payments backend listening on http://localhost:${PORT}`);
  console.log(stripe ? `Stripe is configured in ${stripeMode} mode.` : 'STRIPE_SECRET_KEY is missing.');
});
