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
      role = '',
      lore = '', // <— IMPORTANT: on lit la clé "lore" envoyée par le front
    } = req.body || {};

    // Stripe limite la taille des metadata => on découpe par tranches ~450 chars
    const chunkSize = 450;
    const metadata = { pseudo, genre, role };
    if (typeof lore === 'string' && lore.length > 0) {
      if (lore.length <= chunkSize) {
        metadata.lore = lore;
      } else {
        let part = 1;
        for (let i = 0; i < lore.length; i += chunkSize) {
          metadata[`lore_${part}`] = lore.slice(i, i + chunkSize);
          part++;
        }
        metadata.lore_parts = String(part - 1);
      }
      metadata.lore_len = String(lore.length);
    } else {
      metadata.lore = '';
      metadata.lore_len = '0';
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      // ➜ on met bien les metadata sur la session
      metadata,
      // ➜ et on DUPLIQUE aussi sur le PaymentIntent (très utile côté webhook)
      payment_intent_data: {
        metadata,
      },
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
