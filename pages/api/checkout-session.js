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

    // On récupère TOUT ce que le client envoie
    const {
      pseudo = '',
      genre = '',
      role = '',
      loreRaw = '',
      loreDisplay = '',
    } = req.body || {};

    // On choisit la version affichée si non vide, sinon la brute
    const chosenLore = (typeof loreDisplay === 'string' && loreDisplay.trim())
      ? loreDisplay
      : (typeof loreRaw === 'string' ? loreRaw : '');

    // On peuple les métadonnées, plus un peu de debug (longueur + head)
    const metadata = {
      pseudo,
      genre,
      role,
      lore_len: String((chosenLore || '').length),
      lore_head: (chosenLore || '').slice(0, 80), // pour vérif rapide dans le dashboard
    };

    // Découpage en chunks <= 450 chars pour respecter 500 max / clé metadata
    if (chosenLore) {
      for (let i = 0; i < chosenLore.length; i += 450) {
        metadata[`lore_${Math.floor(i / 450) + 1}`] = chosenLore.slice(i, i + 450);
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
