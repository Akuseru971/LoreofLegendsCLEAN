// pages/api/checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const price = process.env.STRIPE_PRICE_ID; // <-- doit être un price_...
    if (!price) {
      return res.status(400).json({ error: 'Missing STRIPE_PRICE_ID' });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    const origin =
      (req.headers?.origin && typeof req.headers.origin === 'string' && req.headers.origin) ||
      `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
      // metadata: { pseudo: (req.body?.pseudo || '') }, // optionnel
    });

    // on renvoie id + url (fallback côté client si redirectToCheckout échoue)
    return res.status(200).json({ id: session.id, url: session.url || null });
  } catch (err) {
    // LOGS détaillés côté Vercel pour diagnostiquer
    console.error('Checkout session error:', {
      message: err?.message,
      code: err?.code,
      type: err?.type,
      raw: err?.raw,
    });
    return res
      .status(500)
      .json({ error: err?.message || 'Internal error creating session' });
  }
}
