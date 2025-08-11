const handleCheckout = async () => {
  try {
    const stripe = await stripePromise;
    if (!stripe) {
      alert('Stripe not initialized – check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
      return;
    }

    const response = await fetch('/api/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pseudo,
        genre,
        role,
        lore: displayedLore, // ou lore si tu veux
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('checkout-session 500:', data);
      alert(data.error || 'Checkout failed (server).');
      return;
    }

    if (!data?.id) {
      alert('No checkout session returned.');
      return;
    }

    const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
    if (error) {
      console.error('Stripe redirect error:', error);
      alert(error.message || 'Stripe redirect failed');
    }
  } catch (err) {
    console.error('handleCheckout error:', err);
    alert('Unexpected error starting checkout.');
  }
};
