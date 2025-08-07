// /pages/api/webhook.js

import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

const buffer = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // 1. Retrieve customer email
      const customer = await stripe.customers.retrieve(session.customer);

      // 2. Récupérer les données nécessaires
      const email = customer.email;
      const pseudo = session.metadata.pseudo;

      // ⚠️ À ce stade, tu dois récupérer le lore lié à ce pseudo
      // Tu peux le stocker en base au moment de la génération, ou le renvoyer dans metadata si très court

      const lore = `Lore for ${pseudo} — à récupérer dynamiquement`;

      // 3. Send email
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_FROM,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: 'axellvalentino@gmail.com',
        subject: `New Lore Purchase – ${pseudo}`,
        text: `User: ${pseudo}\nEmail: ${email}\n\nGenerated Lore:\n${lore}`,
      });

      res.status(200).json({ received: true });
    } else {
      res.status(200).json({ received: true });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
