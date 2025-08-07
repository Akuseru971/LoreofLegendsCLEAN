// pages/api/checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pseudo, email } = req.body || {};

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    // If you have a pre-created price in Stripe, set STRIPE_PRICE_ID in env
    const priceId = process.env.STRIPE_PRICE_ID;

    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          // Fallback: create price on the fly
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Lore Video',
              description: `Summoner: ${pseudo || 'Unknown'}`,
            },
            unit_amount: 499, // €4.99
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?canceled=true`,
      metadata: { pseudo: pseudo || '', email: email || '' },
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
