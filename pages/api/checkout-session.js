// pages/api/checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    // IMPORTANT : c’est bien un PRICE_ID (price_...), pas un product_…
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID' });
    }

    const origin =
      req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      // Si tu veux remonter des infos client plus tard :
      payment_intent_data: {
        metadata: {
          source: 'lore-of-legends',
        },
      },
      metadata: {
        app: 'lore-of-legends',
      },
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to create checkout session',
    });
  }
}
