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
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!secret) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }
    if (!priceId) {
      return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID' });
    }

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    // ⚠️ Ce que le client envoie depuis index.js
    const {
      pseudo = '',
      genre = '',
      role = '',
      loreRaw = '',
      loreDisplay = '',
    } = (req.body || {});

    // On privilégie le texte brut, sinon la version affichée
    const source = (typeof loreRaw === 'string' && loreRaw.trim().length > 0)
      ? loreRaw
      : (typeof loreDisplay === 'string' ? loreDisplay : '');

    const lore = (source || '').toString();

    // Metadata (clés ~500 chars max chacune)
    const metadata = {
      pseudo,
      genre,
      role,
      lore_len: String(lore.length),
      lore_head: lore.slice(0, 80), // pour debug rapide côté Stripe
    };

    if (lore.length <= 450) {
      metadata.loreRaw = lore;
    } else {
      // découpage en chunks lore_1, lore_2, ...
      for (let i = 0, part = 1; i < lore.length && part <= 30; i += 450, part++) {
        metadata[`lore_${part}`] = lore.slice(i, i + 450);
      }
      metadata.lore_chunked = 'true';
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

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
    return res.status(500).json({ error: err?.message || 'Failed to create checkout session' });
  }
};
