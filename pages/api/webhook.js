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

    // ---- Reconstitution du lore depuis la metadata (lore_1, lore_2, ...) ----
    const md = session.metadata || {};
    const loreChunks = Object.keys(md)
      .filter((k) => /^lore_\d+$/.test(k))
      .sort((a, b) => {
        const ai = parseInt(a.split('_')[1], 10);
        const bi = parseInt(b.split('_')[1], 10);
        return ai - bi;
      })
      .map((k) => md[k] || '');

    const lore = loreChunks.join('');

    const pseudo = md.pseudo || 'Unknown Summoner';
    const genre  = md.genre  || '';
    const role   = md.role   || '';

    const customerEmail = session.customer_details?.email;

    // Transport mail (Gmail ou autre, via vos vars d’env)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,               // ex: smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE === 'true', // 'true' pour 465
      auth: {
        user: process.env.SMTP_USER,             // votre email / compte
        pass: process.env.SMTP_PASS,             // mot de passe / app password
      },
    });

    // Contenu commun
    const htmlLore = `<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.5;">${lore || '(empty)'}</pre>`;
    const textLore = lore || '(empty)';

    // Mail admin
    try {
      await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: process.env.ADMIN_EMAIL, // votre mail d’admin
        subject: `New Lore Purchase - ${pseudo}`,
        text: `Pseudo: ${pseudo}
Email client: ${customerEmail || 'unknown'}
Genre: ${genre}
Role: ${role}

Lore:
${textLore}
`,
        html: `
          <p><strong>Pseudo:</strong> ${pseudo}</p>
          <p><strong>Email client:</strong> ${customerEmail || 'unknown'}</p>
          <p><strong>Genre:</strong> ${genre}</p>
          <p><strong>Role:</strong> ${role}</p>
          <p><strong>Lore:</strong></p>
          ${htmlLore}
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
          text: `Here is your lore:

${textLore}

Thanks for your support!`,
          html: `
            <p>Here is your lore:</p>
            ${htmlLore}
            <p>Thanks for your support!</p>
          `,
        });
      } catch (err) {
        console.error('❌ Envoi mail client échoué:', err);
      }
    }
  }

  res.json({ received: true });
}
