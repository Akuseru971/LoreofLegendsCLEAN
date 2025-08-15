// pages/api/checkout-session.js
/* eslint-disable @typescript-eslint/no-var-requires */
import Stripe from 'stripe';

function splitIntoChunks(str, size = 450) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

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
      lore = '',           // <- on attend cette clé
      loreRaw = '',        // (fallback)
      loreDisplay = '',    // (fallback)
    } = req.body || {};

    // 1) On choisit la meilleure source de texte
    let fullLore = (lore || loreRaw || '').toString().trim();

    // 2) Découpe en chunks (si vide, on enverra quand même lore_len=0)
    const metadata = {
      pseudo,
      genre,
      role,
    };

    const chunks = fullLore ? splitIntoChunks(fullLore, 450) : [];
    if (chunks.length > 0) {
      chunks.forEach((part, idx) => {
        metadata[`lore_${idx + 1}`] = part;
      });
      metadata.lore_head = fullLore.slice(0, 80);
      metadata.lore_len = String(fullLore.length);
    } else {
      metadata.lore = '';           // pour voir clairement côté Stripe
      metadata.lore_head = '';
      metadata.lore_len = '0';
    }

    // 3) Crée la session, + expand pour récupérer le PaymentIntent si besoin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,
      metadata,
      expand: ['payment_intent'],
    });

    // 4) (Optionnel mais robuste) Dépose aussi sur le PaymentIntent (mêmes clés)
    if (session?.payment_intent && typeof session.payment_intent === 'object') {
      const piId = session.payment_intent.id || session.payment_intent;
      try {
        await stripe.paymentIntents.update(piId, { metadata });
      } catch (e) {
        console.warn('PI metadata update failed (non-blocking):', e?.message || e);
      }
    }

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
