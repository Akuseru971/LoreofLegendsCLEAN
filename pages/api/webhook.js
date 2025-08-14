import { buffer } from 'micro';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // ⚠️ Nécessaire pour Stripe
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Lore & infos utilisateur
    const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    const customerEmail = session.customer_details?.email;

    // 📧 Config email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Envoi à l’admin
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `New Lore Purchase - ${pseudo}`,
      text: `Pseudo: ${pseudo}\nEmail: ${customerEmail}\n\nLore:\n${session.metadata?.lore || ''}`,
    });

    // Envoi au client
    if (customerEmail) {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: customerEmail,
        subject: `Your personalized Lore - ${pseudo}`,
        text: `Here is your lore:\n\n${session.metadata?.lore || ''}\n\nThanks for your support!`,
      });
    }
  }

  res.json({ received: true });
}
