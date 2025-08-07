// /api/checkout-session.js
export default async function handler(req, res) {
  const { pseudo } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.origin}/cancel`,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Lore Video',
        },
        unit_amount: 699, // 6.99€
      },
      quantity: 1,
    }],
    metadata: {
      pseudo,
    }
  });

  res.status(200).json({ id: session.id });
}
