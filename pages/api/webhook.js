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
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    const customerEmail = session.customer_details?.email || '';

    // Reconstruire le lore à partir des chunks lore_1, lore_2, ...
    let lore = '';
    if (session.metadata) {
      const chunks = Object.keys(session.metadata)
        .filter((k) => k.startsWith('lore_'))
        .sort((a, b) => {
          const ai = parseInt(a.split('_')[1], 10) || 0;
          const bi = parseInt(b.split('_')[1], 10) || 0;
          return ai - bi;
        })
        .map((k) => session.metadata[k] || '');
      lore = chunks.join('') || '';
      // Fallback si jamais…
      if (!lore && session.metadata.lore_head) {
        lore = session.metadata.lore_head;
      }
    }

    // Transport mail (Gmail / autre)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // Email admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo}`,
        text:
`Pseudo: ${pseudo}
Email client: ${customerEmail || 'unknown'}

Lore (len=${session.metadata?.lore_len || '0'}):
${lore || '(empty)'}
`,
      });
    } catch (err) {
      console.error('❌ Envoi mail admin échoué:', err);
    }

    // Email client
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text: lore && lore.trim()
            ? `Here is your lore:\n\n${lore}\n\nThanks for your support!`
            : `Thanks for your purchase! Your lore is being prepared. If you don't receive it in a few minutes, reply to this email.`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
