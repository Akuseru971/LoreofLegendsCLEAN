// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: { bodyParser: false }, // Stripe nécessite le raw body
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// lire le raw body
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
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    const genre  = session.metadata?.genre  || '';
    const role   = session.metadata?.role   || '';

    // Réassemblage du lore : lore_1, lore_2, ...
    let loreParts = [];
    if (session.metadata) {
      loreParts = Object.entries(session.metadata)
        .filter(([k]) => /^lore_\d+$/.test(k))
        .sort((a, b) => {
          const ai = parseInt(a[0].split('_')[1], 10);
          const bi = parseInt(b[0].split('_')[1], 10);
          return ai - bi;
        })
        .map(([, v]) => String(v ?? ''));
    }
    let lore = loreParts.join('');
    if (!lore) {
      // secours si jamais un ancien format "lore" unique était utilisé
      lore = String(session.metadata?.lore ?? '');
    }

    const customerEmail = session.customer_details?.email || '';

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                 // p.ex. smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',  // true si 465
      auth: {
        user: process.env.SMTP_USER,               // votre email
        pass: process.env.SMTP_PASS,               // mot de passe/app password
      },
    });

    // Mail admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Lore Purchase - ${pseudo}`,
        text:
`Pseudo: ${pseudo}
Genre: ${genre}
Role: ${role}
Customer Email: ${customerEmail || 'unknown'}

Lore:
${lore || '(empty)'}
`,
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
          text:
`Here is your lore:

${lore || '(empty)'}

Thanks for your support!`,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
