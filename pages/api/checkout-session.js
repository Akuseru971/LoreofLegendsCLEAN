// pages/api/checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID } = process.env;

  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY env var' });
  }
  if (!STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID env var' });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  // Corps venant du client
  const { pseudo = '', genre = '', role = '', loreRaw = '', loreDisplay = '' } = req.body || {};

  // Choisir la meilleure source pour le lore
  const pickedLore =
    (typeof loreRaw === 'string' && loreRaw.trim().length > 0 ? loreRaw : '') ||
    (typeof loreDisplay === 'string' ? loreDisplay : '');

  // Nettoyage & découpage metadata (Stripe limite à ~500 chars par clé, 50 clés)
  const safeLore = String(pickedLore || '').slice(0, 5000);
  const metadata = {
    pseudo: String(pseudo || ''),
    genre: String(genre || ''),
    role: String(role || ''),
    lore_len: String(safeLore.length),
  };

  for (let i = 0; i < safeLore.length && i / 450 < 40; i += 450) {
    metadata[`lore_${Math.floor(i / 450) + 1}`] = safeLore.slice(i, i + 450);
  }

  // Origine pour URLs
  const origin =
    req.headers.origin ||
    (req.headers.host ? `https://${req.headers.host}` : 'https://loreof-legends-clean.vercel.app');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata,
    });

    // On renvoie id + url (fallback côté client si redirectToCheckout échoue)
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe create session failed:', err);
    const message = err?.raw?.message || err?.message || 'Stripe error';
    return res.status(500).json({ error: message });
  }
}
