// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: { bodyParser: false }, // Stripe exige le raw body
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// util: lire le raw body depuis le stream Node
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    console.error('❌ Webhook signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // ---- Récup des métadonnées ----
    const md = session.metadata || {};
    const pseudo = md.pseudo || 'Unknown Summoner';
    const genre = md.genre || '';
    const role  = md.role || '';

    // Priorité au lore brut, sinon display, sinon chunks lore_1..n
    let lore = '';
    if (typeof md.loreRaw === 'string' && md.loreRaw.trim().length > 0) {
      lore = md.loreRaw;
    } else if (typeof md.loreDisplay === 'string' && md.loreDisplay.trim().length > 0) {
      lore = md.loreDisplay;
    } else {
      const parts = [];
      for (let i = 1; i <= 30; i++) {
        const key = `lore_${i}`;
        if (md[key] && md[key].length) parts.push(md[key]);
        else if (!md[key]) break;
      }
      lore = parts.join('');
    }

    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      process.env.FALLBACK_CUSTOMER_EMAIL ||
      '';

    // Log utile pour debug (visible dans logs Vercel)
    console.log(
      `💾 Webhook: pseudo=${pseudo}, customer=${customerEmail}, loreLen=${(lore || '').length}`
    );

    // ---- Transport SMTP ----
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                 // ex: smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),  // 465 (secure) ou 587 (starttls)
      secure: process.env.SMTP_SECURE === 'true',  // 'true' pour 465
      auth: {
        user: process.env.SMTP_USER,               // votre email
        pass: process.env.SMTP_PASS,               // votre mdp / app password
      },
    });

    // ---- Mail à l’admin ----
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL, // votre email d’admin
        subject: `New Lore Purchase - ${pseudo}`,
        text:
          `Pseudo: ${pseudo}\n` +
          `Email client: ${customerEmail || 'unknown'}\n` +
          `Genre: ${genre}\nRole: ${role}\n\n` +
          `Lore (len=${(lore || '').length}):\n` +
          `${lore || '(empty)'}`,
      });
    } catch (err) {
      console.error('❌ Envoi mail admin échoué:', err);
    }

    // ---- Mail au client (si email présent) ----
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text:
            (lore && lore.trim().length > 0)
              ? `Here is your lore, ${pseudo}:\n\n${lore}\n\nThanks for your support!`
              : `Thanks for your purchase, ${pseudo}!\n\nWe could not attach your lore automatically. Our team has been notified and will send it shortly.`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  return res.json({ received: true });
}
