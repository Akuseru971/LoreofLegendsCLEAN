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

    const safe = (v) => (typeof v === 'string' ? v.trim() : '');

    const pseudo = safe(req.body?.pseudo);
    const genre  = safe(req.body?.genre);
    const role   = safe(req.body?.role);
    const lore   = safe(req.body?.lore);

    const metadata = { pseudo, genre, role };

    if (lore) {
      // 450 chars max par clé pour rester large vs limite Stripe (500)
      for (let i = 0; i < lore.length; i += 450) {
        const chunk = lore.slice(i, i + 450).trim();
        if (chunk) {
          metadata[`lore_${Math.floor(i / 450) + 1}`] = chunk;
        }
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
