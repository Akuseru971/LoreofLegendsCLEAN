import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { loadStripe } from '@stripe/stripe-js';
import { useCallback } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Preview() {
  const router = useRouter();
  const { pseudo = '' } = router.query;

  const handleCheckout = useCallback(async () => {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        alert('Stripe failed to load on this device.');
        return;
      }
      const resp = await fetch('/api/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data?.error || 'Server error creating checkout session.');
        return;
      }
      if (data?.id) {
        const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
        if (!error) return;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
        alert(error.message || 'Unable to open Stripe Checkout.');
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      alert('No session returned by server.');
    } catch (e) {
      alert('Unexpected error starting checkout.');
    }
  }, [pseudo]);

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <Head>
        <title>Your Lore Preview</title>
        {/* Force le bon viewport sur iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Script src="https://js.stripe.com/v3" strategy="afterInteractive" />

      <div className="max-w-xl mx-auto px-4 pt-safe pb-safe">
        <header className="py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-white/80 hover:text-white"
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">Your Lore is ready</h1>
          <span />
        </header>

        <main>
          <div className="rounded overflow-hidden mb-4">
            <iframe
              src="https://www.tiktok.com/embed/v2/7529586683185040662"
              className="w-full h-[55vh] rounded"
              allow="autoplay; fullscreen; clipboard-write"
              allowFullScreen
            />
          </div>

          <button
            onClick={handleCheckout}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-[18px] text-lg"
          >
            Purchase your Lore Video
          </button>
        </main>

        <footer className="py-6 text-center text-white/60 text-sm">
          Pseudo: {pseudo || '—'}
        </footer>
      </div>
    </div>
  );
}
