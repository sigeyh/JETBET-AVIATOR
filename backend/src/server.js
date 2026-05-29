const path = require('path');
const express = require('express');
const cors = require('cors');

const { initDb, run, get } = require('./db');
const { registerSchema, loginSchema, hashPassword, verifyPassword, signToken, authMiddleware } = require('./auth');

const { z } = require('zod');
const axios = require('axios');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 4000;

// Middleware to ensure DB is initialized
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized && req.path.startsWith('/api')) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (e) {
      console.error('Lazy DB init failed:', e.message);
      // Don't crash here, let the handler handle missing DB
    }
  }
  next();
});

// ---------- Auth routes ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);

    const username = body.username;
    const password_hash = await hashPassword(body.password);

    // Insert user
    const result = await run(`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id`, [username, password_hash]);
    const userId = result.lastID;

    // Create balance row
    await run(`INSERT INTO balances (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`, [userId]);

    // Sign token immediately so frontend doesn't have to call login
    const token = signToken({ userId, username });

    return res.json({ ok: true, token });
  } catch (e) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.message });
    return res.status(400).json({ error: e?.message || 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const row = await get(`SELECT id, username, password_hash FROM users WHERE username = $1`, [body.username]);

    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await verifyPassword(body.password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ userId: row.id, username: row.username });
    return res.json({ token });
  } catch (e) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.message });
    return res.status(400).json({ error: e?.message || 'Login failed' });
  }
});

app.get('/api/me/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const row = await get(`SELECT balance FROM balances WHERE user_id = $1`, [userId]);
    return res.json({ balance: row?.balance ?? 0 });
  } catch (e) {
    return res.status(400).json({ error: e?.message || 'Failed' });
  }
});

// ---------- PayHero STK Push ----------
const stkPushSchema = z.object({
  amount: z.number().positive(),
  phone: z.string().min(7).max(20),
  // Optional display fields
  customerName: z.string().min(1).max(80).optional(),
  // Channel/provider
  channelId: z.number().int().optional(),
  provider: z.string().optional()
});

app.post('/api/deposits/stkpush', authMiddleware, async (req, res) => {
  try {
    const body = stkPushSchema.parse(req.body);

    const userId = req.user.userId;
    const username = req.user.username;

    const amount = body.amount;
    const phone_number = body.phone;
    const channel_id = body.channelId ?? Number(process.env.PAYHERO_CHANNEL_ID || 133);
    const provider = body.provider ?? 'm-pesa';

    // Use something deterministic-ish but unique for the reference
    const reference = `jetbet-${userId}-${Date.now()}`;
    const external_reference = reference;

    const customer_name = body.customerName ?? username;

    const callbackBase = process.env.PUBLIC_CALLBACK_BASE || 'http://localhost:4000';
    const callback_url = `${callbackBase}/api/deposits/payhero/callback`;

    // Persist deposit event as pending
    await run(
      `INSERT INTO deposit_events (reference, user_id, amount, phone, payload_json, payment_success, provider_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        reference,
        userId,
        amount,
        phone_number,
        JSON.stringify({ amount, phone_number, channel_id, provider, external_reference, customer_name, callback_url }),
        0,
        null
      ]
    );

    const PAYHERO_ACCOUNT_ID = process.env.PAYHERO_ACCOUNT_ID || '6902';
    // Prefer Basic Auth env, but fall back to provided hardcoded token
    const PAYHERO_BASIC_AUTH = process.env.PAYHERO_BASIC_AUTH || 'Basic eE9SOTkxaHhYaUc0cmZXVG41ZjE6MDFXR0N6WllqTlZoZmtOMHFVQkY4MjhkUmpxM2ZVclBsRVRQZVFRZQ==';
    const PAYHERO_URL = process.env.PAYHERO_URL || 'https://backend.payhero.co.ke/api/v2/payments';

    if (!PAYHERO_ACCOUNT_ID || !PAYHERO_BASIC_AUTH) {
      return res.status(500).json({ error: 'PayHero credentials missing (PAYHERO_ACCOUNT_ID, PAYHERO_BASIC_AUTH)' });
    }


    // IMPORTANT: use the request shape you provided.
    const payheroBody = {
      amount,
      phone_number,
      channel_id,
      provider,
      external_reference,
      customer_name,
      callback_url
    };

    console.log('[PayHero STK] payheroBody:', payheroBody);
    console.log('[PayHero STK] callback_url:', callback_url);
    console.log('[PayHero STK] using channel/provider:', channel_id, provider);
    console.log('[PayHero STK] external_reference:', external_reference);

    const resp = await axios({
      method: 'POST',
      url: PAYHERO_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: PAYHERO_BASIC_AUTH,
        'x-account-id': PAYHERO_ACCOUNT_ID
      },
      data: payheroBody,
      timeout: 15000
    });

    console.log('[PayHero STK] response status:', resp.status);
    console.log('[PayHero STK] response data:', resp.data);

    // Return reference and whatever PayHero responded with
    return res.json({ ok: true, reference, payhero: resp.data });
  } catch (e) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.message });
    return res.status(400).json({ error: e?.response?.data || e?.message || 'STK push failed' });
  }
});

// PayHero callback
app.post('/api/deposits/payhero/callback', async (req, res) => {
  try {
    const payload = req.body;
    const paymentSuccess = !!payload?.paymentSuccess;
    const reference = payload?.reference;

    if (!reference) return res.status(400).json({ error: 'Missing reference' });

    const event = await get(`SELECT * FROM deposit_events WHERE reference = $1`, [reference]);

    if (!event) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (paymentSuccess) {
      const amount = Number(payload?.amount ?? event.amount);
      const provider_reference = payload?.providerReference ?? payload?.provider_reference ?? null;

      // Mark event success
      await run(
        `UPDATE deposit_events
         SET payment_success = 1, provider_reference = $1, payload_json = $2
         WHERE reference = $3`,
        [provider_reference, JSON.stringify(payload), reference]
      );

      // Credit balance
      await run(
        `UPDATE balances SET balance = balance + $1 , updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [amount, event.user_id]
      );
    } else {
      await run(
        `UPDATE deposit_events SET payment_success = 0, payload_json = $1 WHERE reference = $2`,
        [JSON.stringify(payload), reference]
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e?.message || 'Callback failed' });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    env: {
      hasDb: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// For local testing
if (process.env.NODE_ENV !== 'production') {
  initDb()
    .then(() => {
      app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
    })
    .catch((e) => {
      console.error('DB init failed', e);
    });
}

module.exports = app;

