// pages/api/checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  // N'accepte que POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Récupère ce que tu envoies depuis le client (ex: pseudo)
    const { pseudo } = req.body || {};

    // ⚠️ Mets ici ton prix Stripe (Price ID, ex: price_XXXX)
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({ error: 'Missing STRIPE_PRICE_ID env var' });
    }

    // URLs de redirection (à mettre à jour si tu veux tes propres pages)
    const origin =
      req.headers.origin ||
      `https://${req.headers.host}` ||
      'https://loreoflegendsclean.vercel.app';

    const successUrl = `${origin}/success`;
    const cancelUrl = origin;

    // Crée la session de paiement
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // On peut stocker des infos utiles pour le webhook
      metadata: {
        pseudo: pseudo || '',
      },
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to create checkout session',
    });
  }
}
