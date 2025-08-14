/* pages/api/checkout-session.js */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID; // MUST be price_***

    if (!secret) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID must be a Price ID (starts with "price_")' });
    }

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    const {
      pseudo = '',
      genre = '',
      role = '',
      loreRaw = '',
      loreDisplay = '',
    } = req.body || {};

    const source =
      (typeof loreRaw === 'string' && loreRaw.trim()) ||
      (typeof loreDisplay === 'string' && loreDisplay.trim()) ||
      '';

    const lore = String(source);
    const metadata = {
      pseudo,
      genre,
      role,
      lore_len: String(lore.length),
      lore_head: lore.slice(0, 80),
    };

    if (lore.length <= 450) {
      metadata.lore_1 = lore;
    } else {
      for (let i = 0, part = 1; i < lore.length && part <= 30; i += 450, part++) {
        metadata[`lore_${part}`] = lore.slice(i, i + 450);
      }
    }

    // Build reliable origin (works on Vercel/localhost)
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    // surface message to client for easier debugging
    return res.status(500).json({ error: err?.message || 'Failed to create checkout session' });
  }
};
