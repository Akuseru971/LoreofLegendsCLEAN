// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function joinLoreFromChunks(meta = {}) {
  // reconstruit lore à partir de lore_1, lore_2, ...
  const parts = [];
  const keys = Object.keys(meta).filter((k) => /^lore_\d+$/.test(k));
  keys.sort((a, b) => {
    const ai = parseInt(a.split('_')[1], 10);
    const bi = parseInt(b.split('_')[1], 10);
    return ai - bi;
  });
  for (const k of keys) parts.push(meta[k] || '');
  if (parts.length) return parts.join('');
  // fallback legacy
  if (typeof meta.lore === 'string') return meta.lore;
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    // ⚠️ expand pour récupérer payment_intent.metadata
    const fullSession = await stripe.checkout.sessions.retrieve(
      event.data.object.id,
      { expand: ['payment_intent'] }
    );

    const s = fullSession;
    const metaSession = s.metadata || {};
    const metaPI = (s.payment_intent && s.payment_intent.metadata) || {};

    const pseudo = metaSession.pseudo || metaPI.pseudo || 'Unknown Summoner';
    const genre = metaSession.genre || metaPI.genre || '';
    const role  = metaSession.role  || metaPI.role  || '';
    const customerEmail = s.customer_details?.email;

    // reconstruit depuis les CHUNKS (session puis PI)
    let lore = joinLoreFromChunks(metaSession);
    if (!lore) lore = joinLoreFromChunks(metaPI);

    // transport SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // mail admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo}`,
        text:
`Pseudo: ${pseudo}
Email client: ${customerEmail || 'unknown'}
Genre: ${genre}
Role: ${role}

Lore (len=${lore?.length || 0}):
${lore || '(empty)'}
`,
      });
    } catch (err) {
      console.error('❌ Envoi mail admin échoué:', err);
    }

    // mail client
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text: lore && lore.length
            ? `Here is your lore:\n\n${lore}\n\nThanks for your support!`
            : `We received your order but the lore text was empty.\nIf this seems wrong, please reply to this email.`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
