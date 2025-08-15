// pages/api/webhook.js
import Stripe from 'stripe';

// ⚠️ Stripe a besoin du RAW body pour vérifier la signature
export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Utilitaire: récupérer le raw body du stream Node
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

  // On loggue proprement l’événement (et seulement ça)
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Quelques infos utiles à tracer
        const summary = {
          session_id: session.id,
          paid: session.payment_status === 'paid',
          email: session?.customer_details?.email || null,
          pseudo: session?.metadata?.pseudo || null,
          lore_len: Number(session?.metadata?.lore_len || 0),
          has_lore: Boolean(session?.metadata?.lore || session?.metadata?.lore_1),
          created: session.created,
          amount_total: session.amount_total,
          currency: session.currency,
          livemode: session.livemode,
        };

        console.log('✅ checkout.session.completed', summary);

        // 👉 Ici, pas d’email. Si tu veux persister en base, c’est l’endroit.
        break;
      }

      default:
        // Pour débogage des autres events éventuels
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        break;
    }

    // Stripe est content si on répond 200 rapidement
    return res.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    // Répondre 200 quand même pour éviter des retries en boucle,
    // ou 500 si tu veux que Stripe retente.
    return res.status(200).json({ received: true, note: 'logged only' });
  }
}
