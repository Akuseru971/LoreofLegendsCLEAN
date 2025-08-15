// pages/api/fulfill.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const { session_id, lore = '', pseudo = '', genre = '', role = '' } = req.body || {};

    if (!session_id) return res.status(400).json({ error: 'Missing session_id' });
    if (!lore || !lore.trim()) return res.status(400).json({ error: 'Missing lore text' });

    // 1) Vérifie la session (payée)
    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Session not paid' });
    }

    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      process.env.FALLBACK_CUSTOMER_EMAIL || '';

    // 2) Envoi des mails
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,               // ex: smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // Admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo || 'Unknown'}`,
        text:
`Pseudo: ${pseudo || 'Unknown'}
Email client: ${customerEmail || 'unknown'}
Genre: ${genre || ''}
Role: ${role || ''}

Lore (len=${lore.length}):
${lore}

Raw session id: ${session_id}`,
      });
    } catch (e) {
      console.error('Mail admin failed:', e);
    }

    // Client
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo || ''}`,
          text:
`Here is your lore:

${lore}

Thanks for your support!
— Lore of Legends`,
        });
      } catch (e) {
        console.error('Mail client failed:', e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('fulfill error:', err);
    return res.status(500).json({ error: 'Fulfillment failed' });
  }
}
