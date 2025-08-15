// pages/api/checkout-session.js
import Stripe from 'stripe';
import cookie from 'cookie';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// util: reconstruire le lore à partir d'un objet metadata {lore_1, lore_2, ...}
function joinLoreFromChunks(md = {}) {
  const chunks = [];
  let i = 1;
  while (md[`lore_${i}`] !== undefined) {
    chunks.push(md[`lore_${i}`]);
    i++;
  }
  return chunks.join('');
}

// util: split en morceaux <= 450 chars
function splitLoreIntoChunks(lore = '') {
  const out = {};
  if (!lore) return out;
  for (let i = 0; i < lore.length; i += 450) {
    out[`lore_${Math.floor(i / 450) + 1}`] = lore.slice(i, i + 450);
  }
  out['lore_len'] = String(lore.length);
  out['lore_head'] = lore.slice(0, 80);
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Lire inputs côté serveur
    const body = req.body || {};
    const {
      pseudo = '',
      genre = '',
      role = '',
      loreRaw = '',
      loreDisplay = '',
    } = body;

    // 2) Essayer aussi le cookie `loreCache` (déposé par /api/cache-lore)
    let cookieLore = '';
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      if (cookies.loreCache) {
        // On a stocké du JSON dans le cookie
        const parsed = JSON.parse(decodeURIComponent(cookies.loreCache));
        if (parsed?.lore) cookieLore = String(parsed.lore);
      }
    } catch {}

    // 3) Choisir la meilleure source (priorité: body.loreRaw > cookieLore > loreDisplay)
    const chosenLore = (loreRaw && String(loreRaw).trim())
      || (cookieLore && String(cookieLore).trim())
      || (loreDisplay && String(loreDisplay).trim())
      || '';

    // 4) Construire metadata communs
    const baseMeta = {
      pseudo: String(pseudo || ''),
      genre: String(genre || ''),
      role: String(role || ''),
    };

    // 5) Split du lore en chunks
    const loreChunks = splitLoreIntoChunks(chosenLore);

    // 6) Debug serveur
    console.log('[checkout-session] chosenLore.len=', chosenLore.length);
    console.log('[checkout-session] pseudo/genre/role=', baseMeta);
    console.log('[checkout-session] lore_head=', chosenLore.slice(0, 80));

    // 7) Créer la session avec metadata + payment_intent_data.metadata (double écriture)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/`,

      // metadata côté Session
      metadata: {
        ...baseMeta,
        ...loreChunks,
      },

      // metadata côté PaymentIntent
      payment_intent_data: {
        metadata: {
          ...baseMeta,
          ...loreChunks,
        },
      },
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
