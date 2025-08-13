// pages/api/checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  // 1) Préflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2) Récupération du priceId (Option A)
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID' });
  }

  // 3) Petit helper pour créer la session
  async function createSession() {
    // Récupère pseudo/email si envoyés
    let body = {};
    try {
      // pages/api remplit req.body; si vide, pas grave.
      body = req.body || {};
      // Dans certains cas (edge / parse json), on peut fallback :
      if (!Object.keys(body).length && typeof req.json === 'function') {
        body = await req.json();
      }
    } catch (_) {}

    const { pseudo = '', email = '' } = body;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      metadata: { pseudo, email },
    });

    return session;
  }

  try {
    if (req.method === 'POST' || req.method === 'GET') {
      const session = await createSession();
      return res.status(200).json({ id: session.id });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: err.message || 'Stripe error' });
  }
}
