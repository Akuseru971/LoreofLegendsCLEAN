// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // Stripe a besoin du raw body
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// util: lire le raw body depuis le stream Node
async function getRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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
    const session = event.data.object;

    const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    const lore   = session.metadata?.lore || '';
    const customerEmail = session.customer_details?.email;

    // Transport mail (Gmail ou autre, via vos vars d’env)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,               // ex: smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true', // 'true' pour 465
      auth: {
        user: process.env.SMTP_USER,             // votre email
        pass: process.env.SMTP_PASS,             // mot de passe / app password
      },
    });

    // Mail admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL, // votre mail d’admin
        subject: `New Lore Purchase - ${pseudo}`,
        text: `Pseudo: ${pseudo}\nEmail client: ${customerEmail || 'unknown'}\n\nLore:\n${lore}`,
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
          text: `Here is your lore:\n\n${lore}\n\nThanks for your support!`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
