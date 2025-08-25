// pages/preview.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Preview() {
  const [pseudo, setPseudo] = useState('');
  const [genre, setGenre] = useState('');
  const [role, setRole] = useState('');
  const [lore, setLore] = useState('');
  const [displayedLore, setDisplayedLore] = useState('');

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams.get('pseudo') || '';
      setPseudo(p);

      // best-effort restore from localStorage (optional)
      const lastLore = localStorage.getItem('lastLore') || '';
      const lastGenre = localStorage.getItem('lastGenre') || '';
      const lastRole = localStorage.getItem('lastRole') || '';
      setLore(lastLore);
      setDisplayedLore(lastLore);
      setGenre(lastGenre);
      setRole(lastRole);
    } catch {}
  }, []);

  const startCheckout = async (productType /* 'bundle' | 'image_only' */) => {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        alert('Stripe failed to load on this device.');
        return;
      }

      // we still send the lore if we have it (even for image_only)
      const payload = {
        pseudo,
        genre,
        role,
        lore,
        loreDisplay: (displayedLore || '').trim(),
        productType, // 👈 crucial: tell server which price to use
      };

      // extra channel for long lore
      const b64 = typeof window !== 'undefined'
        ? btoa(unescape(encodeURIComponent(lore || '')))
        : '';

      const resp = await fetch('/api/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lore-b64': b64,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error('checkout-session error:', data);
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
      console.error('startCheckout exception:', e);
      alert(e?.message || 'Unexpected error starting checkout.');
    }
  };

  return (
    <>
      <Head><title>Preview • Lore of Legends</title></Head>
      <div className="min-h-screen bg-black text-white px-4 py-8">
        <h1 className="text-2xl font-bold text-center mb-4">Your Lore Preview</h1>

        {/* optional: show the lore */}
        {displayedLore ? (
          <div className="mx-auto max-w-2xl bg-gray-900 rounded-lg p-4 whitespace-pre-line mb-6">
            {displayedLore}
          </div>
        ) : null}

        {/* TikTok / Video preview (your existing embed) */}
        <div className="mx-auto max-w-2xl rounded-lg overflow-hidden mb-8">
          <iframe
            src="https://www.tiktok.com/embed/v2/7529586683185040662"
            className="w-full h-[58vh]"
            allow="autoplay; fullscreen; clipboard-write"
            allowFullScreen
          />
        </div>

        {/* Two clear CTAs */}
        <div className="mx-auto max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => startCheckout('bundle')}
            className="w-full rounded-[18px] bg-blue-600 hover:bg-blue-700 font-bold py-3"
          >
            Get Lore + Image (€8.99)
          </button>

          <button
            onClick={() => startCheckout('image_only')}
            className="w-full rounded-[18px] bg-green-600 hover:bg-green-700 font-bold py-3"
          >
            Get Image Only (€2.99)
          </button>
        </div>
      </div>
    </>
  );
}
