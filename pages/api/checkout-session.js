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

    const { pseudo = '', genre = '', role = '', lore = '' } = req.body || {};

    // Split lore into 450-char chunks to fit Stripe metadata limits
    const metadata = { pseudo, genre, role };
    if (typeof lore === 'string' && lore.length) {
      for (let i = 0; i < lore.length; i += 450) {
        metadata[`lore_${Math.floor(i / 450) + 1}`] = lore.slice(i, i + 450);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        { price: process.env.STRIPE_PRICE_ID, quantity: 1 },
      ],
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
