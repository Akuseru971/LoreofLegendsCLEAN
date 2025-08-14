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

    // Build metadata safely within Stripe limits (50 keys, 500 chars per value)
    const metadata = {
      pseudo,
      genre,
      role,
    };

    if (typeof lore === 'string' && lore.length) {
      // Helpful preview in case chunks fail for any reason
      metadata.lore_preview = lore.slice(0, 120);

      // Chunk into <= 450 chars to stay well below Stripe 500-char field limit
      const chunkSize = 450;
      const chunks = [];
      for (let i = 0; i < lore.length; i += chunkSize) {
        chunks.push(lore.slice(i, i + chunkSize));
      }
      // Name chunks with left-padded indexes so they sort correctly lexicographically
      const pad = String(chunks.length).length;
      chunks.forEach((part, idx) => {
        const key = `lore_${String(idx + 1).padStart(pad, '0')}`;
        metadata[key] = part;
      });
      metadata.lore_chunks = String(chunks.length);
    } else {
      metadata.lore_preview = '';
      metadata.lore_chunks = '0';
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
