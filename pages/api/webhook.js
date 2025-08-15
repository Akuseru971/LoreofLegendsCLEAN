// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // Stripe a besoin du raw body
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Lire le raw body (sans bodyParser)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Recompose le texte depuis un objet metadata (session ou PI)
function extractLoreFromMetadata(md = {}) {
  if (!md) return '';

  // priorité aux parties chunkées
  if (md.lore_parts) {
    const parts = parseInt(md.lore_parts, 10) || 0;
    let out = '';
    for (let i = 1; i <= parts; i++) {
      const key = `lore_${i}`;
      if (typeof md[key] === 'string') out += md[key];
    }
    if (out) return out;
  }

  // sinon clé "lore" simple
  if (typeof md.lore === 'string' && md.lore.length) return md.lore;

  // fallback : concaténer toutes les lore_i si présentes
  const keys = Object.keys(md).filter((k) => /^lore_\d+$/.test(k));
  if (keys.length) {
    return keys
      .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
      .map((k) => md[k] || '')
      .join('');
  }

  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

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
    try {
      // Récupère la session + PaymentIntent (pour lire les metadata du PI aussi)
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
        expand: ['payment_intent', 'customer'],
      });

      const sessionMd = session.metadata || {};
      const pi = session.payment_intent;
      const piMd = (pi && pi.metadata) || {};

      const pseudo = sessionMd.pseudo || piMd.pseudo || 'Unknown Summoner';
      const genre = sessionMd.genre || piMd.genre || '';
      const role = sessionMd.role || piMd.role || '';

      // 👉 Récupération robuste du lore
      let lore =
        extractLoreFromMetadata(sessionMd) || extractLoreFromMetadata(piMd) || '';

      const customerEmail =
        session.customer_details?.email ||
        (session.customer && session.customer.email) ||
        '';

      // Log pour debug (visible dans Vercel)
      console.log('Webhook assembled lore length:', lore.length);
      console.log('Webhook pseudo/genre/role:', { pseudo, genre, role });

      // Transport mail
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, // ex: smtp.gmail.com
        port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE === 'true', // true pour 465
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const adminTo = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
      const from = process.env.SENDER_EMAIL || process.env.SMTP_USER;

      // Mail admin
      await transporter.sendMail({
        from,
        to: adminTo,
        subject: `New Lore Purchase - ${pseudo}`,
        text:
          `Pseudo: ${pseudo}\nEmail client: ${customerEmail || 'unknown'}\n` +
          `Genre: ${genre}\nRole: ${role}\n\n` +
          `Lore (len=${lore.length}):\n${lore || '(empty)'}\n\n` +
          `Raw session id: ${session.id}`,
      });

      // Mail client
      if (customerEmail) {
        await transporter.sendMail({
          from,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text:
            `Hey ${pseudo},\n\nHere is your personalized lore:\n\n` +
            `${lore || '(empty)'}\n\n` +
            `Thanks for your support!`,
        });
      }
    } catch (err) {
      console.error('❌ Error handling checkout.session.completed:', err);
      // On ne renvoie pas 500 pour éviter les retries infinis si c’est une erreur non critique
    }
  }

  res.json({ received: true });
}
