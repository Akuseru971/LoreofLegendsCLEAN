// pages/api/checkout-session.js
/* eslint-disable @typescript-eslint/no-var-requires */
import Stripe from 'stripe';

function splitIntoChunks(str, size = 450) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const {
      pseudo = '',
      genre = '',
      role = '',
      lore = '',
      loreRaw = '',
      loreDisplay = '',
      productType = 'bundle', // NEW: 'bundle' | 'image_only'
    } = req.body || {};

    // pick correct price by product type
    const priceId =
      productType === 'image_only'
        ? process.env.STRIPE_PRICE_IMAGE_ONLY
        : (process.env.STRIPE_PRICE_LORE_BUNDLE || process.env.STRIPE_PRICE_ID); // fallback to old var if present

    if (!priceId) {
      return res.status(400).json({ error: 'Stripe price not configured for selected product.' });
    }

    // 1) Two possible lore sources: body AND/OR base64 header
    let headerLore = '';
    try {
      const b64 = req.headers['x-lore-b64'];
      if (typeof b64 === 'string' && b64.length) {
        headerLore = Buffer.from(b64, 'base64').toString('utf8');
      }
    } catch {}

    let fullLore = (lore || loreRaw || headerLore || '').toString().trim();

    // Server debug (Vercel logs)
    console.log('[checkout-session] lengths:', {
      productType,
      bodyLoreLen: (lore || '').length,
      loreRawLen: (loreRaw || '').length,
      headerLoreLen: (headerLore || '').length,
      chosenLen: fullLore.length,
      head: fullLore.slice(0, 80),
    });

    // Build metadata (Stripe limits 50 keys, 500 chars per value approx.)
    const metadata = { pseudo, genre, role, product_type: productType };
    const chunks = fullLore ? splitIntoChunks(fullLore, 450) : [];

    if (chunks.length > 0) {
      chunks.forEach((part, idx) => {
        metadata[`lore_${idx + 1}`] = part;
      });
      metadata.lore_head = fullLore.slice(0, 80);
      metadata.lore_len = String(fullLore.length);
    } else {
      metadata.lore = '';
      metadata.lore_head = '';
      metadata.lore_len = '0';
    }

    // URLs (fallbacks)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (req.headers.origin && typeof req.headers.origin === 'string'
        ? req.headers.origin
        : `https://${req.headers.host}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
      metadata,
      expand: ['payment_intent'],
    });

    // Duplicate metadata onto PI for webhook robustness
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
