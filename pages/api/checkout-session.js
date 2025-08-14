// pages/api/checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const {
      pseudo = '',
      genre = '',
      role = '',
      loreRaw = '',
      loreDisplay = '',
    } = req.body || {};

    // Choisir la meilleure source de vérité
    const lore = (typeof loreDisplay === 'string' && loreDisplay.trim().length > 0)
      ? loreDisplay
      : (typeof loreRaw === 'string' ? loreRaw : '');

    const metadata = {
      pseudo,
      genre,
      role,
      lore_len: String(lore.length || 0),
      lore_head: lore.slice(0, 120), // utile pour vérifier rapidement côté Stripe
    };

    // Chunks (max ~10 * 450 = ~4500 chars) pour rester sous les limites Stripe
    if (lore && lore.length) {
      const CHUNK = 450;
      const MAX_CHUNKS = 10;
      const total = Math.min(Math.ceil(lore.length / CHUNK), MAX_CHUNKS);
      for (let i = 0; i < total; i++) {
        const start = i * CHUNK;
        metadata[`lore_${i + 1}`] = lore.slice(start, start + CHUNK);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      metadata,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
