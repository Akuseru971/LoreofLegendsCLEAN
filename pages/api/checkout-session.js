// pages/api/checkout-session.js
import Stripe from 'stripe';

function readCookies(cookieHeader = '') {
  const out = {};
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = v;
    }
  });
  return out;
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

    let { pseudo = '', genre = '', role = '', loreRaw = '', loreDisplay = '' } = req.body || {};

    // 🔁 Fallback: si pas de lore dans le body, on lit le cookie mis par /api/cache-lore
    if (!loreRaw || loreRaw.length === 0) {
      const cookies = readCookies(req.headers.cookie || '');
      if (cookies.lore_cache) {
        try {
          const decoded = Buffer.from(cookies.lore_cache, 'base64').toString('utf8');
          loreRaw = decoded || loreRaw;
        } catch {}
      }
      if ((!pseudo || !genre || !role) && cookies.lore_meta) {
        try {
          const meta = JSON.parse(Buffer.from(cookies.lore_meta, 'base64').toString('utf8'));
          pseudo = pseudo || meta.pseudo || '';
          genre  = genre  || meta.genre  || '';
          role   = role   || meta.role   || '';
        } catch {}
      }
    }

    // On prépare les metadata Stripe (chunk si long)
    const metadata = { pseudo, genre, role };
    const src = loreRaw || ''; // on met la version brute
    metadata.lore_len = String(src.length);
    if (src.length) {
      // 500 chars max par valeur — on segmente en ~450
      for (let i = 0, part = 1; i < src.length; i += 450, part++) {
        metadata[`lore_${part}`] = src.slice(i, i + 450);
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
