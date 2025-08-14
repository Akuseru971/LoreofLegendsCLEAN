// pages/api/webhook.js
import Stripe from 'stripe';
import { buffer } from 'micro';
import nodemailer from 'nodemailer';

export const config = {
  api: { bodyParser: false }, // We need the raw body for Stripe signature
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  let event;
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Email collected by Stripe at checkout
    const customerEmail =
      session.customer_details?.email || session.customer_email || '';

    const md = session.metadata || {};
    // Rebuild lore from chunks lore_1, lore_2, ...
    const chunkKeys = Object.keys(md)
      .filter((k) => k.startsWith('lore_'))
      .sort((a, b) => {
        const ai = parseInt(a.split('_')[1] || '0', 10);
        const bi = parseInt(b.split('_')[1] || '0', 10);
        return ai - bi;
      });

    const lore =
      chunkKeys.length > 0 ? chunkKeys.map((k) => md[k]).join('') : (md.lore || '');

    const pseudo = md.pseudo || '';
    const genre = md.genre || '';
    const role = md.role || '';

    // Nodemailer transporter (configure these env vars on Vercel)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true if 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlBlock = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Lore of Legends – Your Runeterra Lore</h2>
        <p><strong>Pseudo:</strong> ${escapeHtml(pseudo)}</p>
        <p><strong>Genre:</strong> ${escapeHtml(genre)} &nbsp; <strong>Role:</strong> ${escapeHtml(role)}</p>
        <hr/>
        <pre style="white-space:pre-wrap;background:#000;color:#fff;padding:16px;border-radius:8px;font-size:15px;margin:0">
${escapeHtml(lore)}
        </pre>
      </div>`.trim();

    const adminHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">New Lore Order</h2>
        <p><strong>Customer email:</strong> ${escapeHtml(customerEmail || 'N/A')}</p>
        ${htmlBlock}
      </div>
    `;

    try {
      // Send to customer if we have their email
      if (customerEmail) {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your Runeterra Lore – ${pseudo || 'Summoner'}`,
          html: htmlBlock,
        });
      }

      // Send to you (admin)
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL,
        subject: `New Lore Order – ${pseudo || 'Summoner'}`,
        html: adminHtml,
      });
    } catch (mailErr) {
      console.error('Email send error:', mailErr);
      // Don’t fail the webhook; just log it.
    }
  }

  res.json({ received: true });
}

// Basic HTML escaping
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
