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
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    const customerEmail = session.customer_details?.email;

    // Reconstruire le lore à partir des chunks lore_1..lore_n
    let lore = '';
    for (let i = 1; i <= 50; i++) {
      const key = `lore_${i}`;
      const val = session.metadata?.[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        lore += val; // concat direct (on a déjà des retours à la ligne dans le chunk)
      } else if (!val) {
        // on s'arrête dès qu’une clé manque (on a fini la séquence)
        break;
      }
    }
    // Fallback si jamais tu avais un seul champ "lore"
    if (!lore && typeof session.metadata?.lore === 'string') {
      lore = session.metadata.lore;
    }

    // Transport mail
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Mail admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo}`,
        text: `Pseudo: ${pseudo}
Email client: ${customerEmail || 'unknown'}

Lore:
${lore || '(empty)'}`,
      });
    } catch (err) {
      console.error('❌ Envoi mail admin échoué:', err);
    }

    // Mail client
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text: `${lore || '(empty)'}\n\nThanks for your support!`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
