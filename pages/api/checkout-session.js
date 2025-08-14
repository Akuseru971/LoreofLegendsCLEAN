// pages/api/checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const {
      pseudo = '',
      genre = '',
      role  = '',
      lore  = '',
    } = req.body || {};

    // Toujours des strings pour Stripe metadata
    const meta = {
      pseudo: String(pseudo || ''),
      genre : String(genre  || ''),
      role  : String(role   || ''),
    };

    const loreStr = String(lore || '');
    if (loreStr.length) {
      // Découpage en blocs de 450 chars
      for (let i = 0; i < loreStr.length; i += 450) {
        meta[`lore_${Math.floor(i / 450) + 1}`] = loreStr.slice(i, i + 450);
      }
    } else {
      // garde une trace explicite si vide
      meta.lore_1 = '';
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url : `${req.headers.origin}/`,
      metadata   : meta,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
