// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // Stripe a besoin du raw body pour vérifier la signature
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// --- util: lire le raw body depuis le stream Node (obligatoire pour signature Stripe) ---
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
    const genre  = session.metadata?.genre  || '';
    const role   = session.metadata?.role   || '';
    const customerEmail = session.customer_details?.email;

    // 🔧 RECONSTRUCTION DU LORE À PARTIR DES CHUNKS lore_1, lore_2, ...
    const loreParts = [];
    Object.keys(session.metadata || {})
      .filter((k) => k.startsWith('lore_'))
      .sort((a, b) => {
        const ai = parseInt(a.split('_')[1], 10);
        const bi = parseInt(b.split('_')[1], 10);
        return ai - bi;
      })
      .forEach((k) => loreParts.push(session.metadata[k]));
    const lore = loreParts.join('') || 'Lore not found';

    // ✉️ Transport mail (via tes variables d'env, ex: Gmail SMTP)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                 // ex: smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),  // 465 si secure=true / 587 si secure=false
      secure: process.env.SMTP_SECURE === 'true',  // 'true' => TLS implicite (465)
      auth: {
        user: process.env.SMTP_USER,               // ton email
        pass: process.env.SMTP_PASS,               // ton app password
      },
    });

    // 👑 Mail admin: récap commande + lore
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL, // ton mail admin
        subject: `New Lore Purchase - ${pseudo}`,
        text:
`New purchase received!

Pseudo: ${pseudo}
Email client: ${customerEmail || 'unknown'}
Genre: ${genre}
Role: ${role}

--- LORE ---
${lore}
`,
      });
      console.log('✅ Mail admin envoyé.');
    } catch (err) {
      console.error('❌ Envoi mail admin échoué:', err);
    }

    // 📦 Mail client: envoi du lore
    if (customerEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: customerEmail,
          subject: `Your personalized Lore - ${pseudo}`,
          text:
`Hi ${pseudo},

Here is your personalized Runeterra Lore:

${lore}

Thanks for your support!
`,
        });
        console.log('✅ Mail client envoyé.');
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    } else {
      console.warn('⚠️ Pas d’email client dans la session Stripe, mail client non envoyé.');
    }
  }

  // Réponse OK pour Stripe
  res.json({ received: true });
}
