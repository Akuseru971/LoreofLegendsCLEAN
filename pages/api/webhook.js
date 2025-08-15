// pages/api/webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: false, // Stripe a besoin du raw body
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// util: lire le raw body
async function getRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// util: reconstruire le lore depuis un objet metadata {lore_1, lore_2, ...}
function joinLoreFromChunks(md = {}) {
  const chunks = [];
  let i = 1;
  while (md[`lore_${i}`] !== undefined) {
    chunks.push(md[`lore_${i}`]);
    i++;
  }
  const full = chunks.join('');
  return full;
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

    // 1) Essayer de lire le lore depuis la Session
    let pseudo = session.metadata?.pseudo || 'Unknown Summoner';
    let genre  = session.metadata?.genre  || '';
    let role   = session.metadata?.role   || '';

    let lore = joinLoreFromChunks(session.metadata || {});
    let loreLen = lore.length;

    // 2) Si vide, on lit le PaymentIntent (car on a aussi écrit la metadata dessus)
    if (!lore || loreLen === 0) {
      try {
        const piId = session.payment_intent;
        if (piId) {
          const pi = await stripe.paymentIntents.retrieve(piId);
          if (pi?.metadata) {
            const fallbackLore = joinLoreFromChunks(pi.metadata);
            if (fallbackLore && fallbackLore.length > 0) {
              lore = fallbackLore;
              loreLen = lore.length;
              // on peut aussi mettre à jour pseudo/genre/role si absents
              if (!pseudo) pseudo = pi.metadata?.pseudo || pseudo;
              if (!genre)  genre  = pi.metadata?.genre  || genre;
              if (!role)   role   = pi.metadata?.role   || role;
            }
          }
        }
      } catch (e) {
        console.error('❌ Failed to read PaymentIntent metadata:', e);
      }
    }

    console.log(`[webhook] Lore len=${loreLen}, head="${(lore || '').slice(0,80)}"`);

    const customerEmail = session.customer_details?.email;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
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
Email client: ${customerEmail || 'unknown'}
Genre: ${genre}
Role: ${role}

Lore (len=${loreLen}):
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
