// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // Stripe needs the raw body
  },
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

    // --- Rebuild lore from metadata robustly ---
    const md = session.metadata || {};
    const keys = Object.keys(md);
    console.log('🔎 Metadata keys on session:', keys);

    // Gather all lore_### keys and sort
    const loreParts = keys
      .filter((k) => /^lore_\d+/.test(k))
      .sort()
      .map((k) => md[k]);

    // Fallbacks: joined chunks -> single lore -> preview -> empty
    const lore =
      (loreParts.length ? loreParts.join('') : '') ||
      md.lore ||
      md.lore_preview ||
      '';

    const pseudo = md.pseudo || 'Unknown Summoner';
    const genre  = md.genre  || '';
    const role   = md.role   || '';
    const customerEmail = session.customer_details?.email;

    console.log('✅ Rebuilt lore length:', lore.length);
    console.log('👤 Pseudo:', pseudo, '📧 Customer:', customerEmail);

    // --- Mail transport ---
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,               // e.g. smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true', // true for 465
      auth: {
        user: process.env.SMTP_USER,             // full email or username
        pass: process.env.SMTP_PASS,             // app password / SMTP password
      },
    });

    // Admin email (to you)
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo}`,
        text:
`Pseudo: ${pseudo}
Genre: ${genre}
Role: ${role}
Email client: ${customerEmail || 'unknown'}

Lore:
${lore || '(empty)'}
`,
      });
      console.log('📫 Admin email sent');
    } catch (err) {
      console.error('❌ Admin email failed:', err);
    }

    // Customer email (to buyer)
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text:
`Here is your lore:

${lore || '(empty)'}

Thanks for your support!`,
        });
        console.log('📫 Customer email sent');
      } catch (err) {
        console.error('❌ Customer email failed:', err);
      }
    }
  }

  res.json({ received: true });
}
