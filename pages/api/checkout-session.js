// pages/api/checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const price = process.env.STRIPE_PRICE_ID;
    if (!price) return res.status(400).json({ error: 'Missing STRIPE_PRICE_ID' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?canceled=1`,
      // utile pour compatibilité, Stripe renvoie souvent `url` :
      allow_promotion_codes: false,
    });

    return res.status(200).json({ id: session.id, url: session.url || null });
  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: 'Internal error creating session' });
  }
}
