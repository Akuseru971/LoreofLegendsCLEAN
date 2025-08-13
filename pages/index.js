// pages/index.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Script from 'next/script';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function Home() {
  const [pseudo, setPseudo] = useState('');
  const [genre, setGenre] = useState('Man');
  const [role, setRole] = useState('Top');
  const [lore, setLore] = useState('');
  const [displayedLore, setDisplayedLore] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setLore('');
    setDisplayedLore('');
    setShowPopup(false);
    const response = await fetch('/api/generate-lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, genre, role }),
    });
    const data = await response.json();
    setLore(data.lore);
    setLoading(false);
  };

  useEffect(() => {
    if (!lore) return;
    let i = 0;
    const it = setInterval(() => {
      setDisplayedLore((prev) => prev + lore.charAt(i));
      i++;
      if (i >= lore.length) clearInterval(it);
    }, 12);
    return () => clearInterval(it);
  }, [lore]);

  const handleCheckout = async () => {
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
        console.error('API checkout-session non OK:', data);
        alert(data?.error || 'Server error creating checkout session.');
        return;
      }

      if (data?.id) {
        const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
        if (!error) return;

        console.warn('redirectToCheckout error, will fallback:', error);
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
      console.error('handleCheckout error:', e);
      alert('Unexpected error starting checkout.');
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white font-serif">
      <Head>
        <title>Lore of Legends</title>
      </Head>

      <Script src="https://js.stripe.com/v3" strategy="afterInteractive" />

      <video autoPlay loop muted className="absolute top-0 left-0 w-full h-full object-cover z-0">
        <source src="/background.mp4" type="video/mp4" />
      </video>

      <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-60 z-10" />

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4">
        <Image src="/logo.png" alt="Logo" width={160} height={160} className="mb-4" />

        <h1 className="text-3xl font-bold mb-6 text-white">Generate your Runeterra Lore</h1>

        <div className="bg-black bg-opacity-40 p-6 rounded-lg backdrop-blur w-15 max-w-sm space-y-4">
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="h-14 p-3 rounded-full w-full bg-white text-black"
          >
            <option>Man</option>
            <option>Woman</option>
            <option>Creature</option>
          </select>

          <input
            type="text"
            placeholder="Enter your Summoner Name"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="h-14 p-3 rounded-full w-full text-black"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-14 p-3 rounded-full w-full bg-white text-black"
          >
            <option>Top</option>
            <option>Mid</option>
            <option>Jungle</option>
            <option>ADC</option>
            <option>Support</option>
          </select>

          <button
            onClick={handleGenerate}
            className="h-14 bg-blue-600 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-full w-full"
          >
            {loading ? 'Generating...' : 'Generate My Lore'}
          </button>
        </div>

        {lore && (
          <div className="mt-24 w-fit flex flex-col items-center justify-center animate-fade-in">
            <div className="lore-box bg-black text-white p-6 rounded-lg max-w-xl w-full text-center text-md leading-relaxed shadow-lg mb-6">
              <span className="whitespace-pre-line">{displayedLore}</span>
            </div>
            <button
              className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-full"
              onClick={() => setShowPopup(true)}
            >
              Generate your Lore Video
            </button>
          </div>
        )}

        {showPopup && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-900 text-white p-6 rounded-lg max-w-xl w-fit relative">
              <button
                className="absolute top-2 right-2 text-white text-xl"
                onClick={() => setShowPopup(false)}
              >
                ✖
              </button>
              <h2 className="text-xl font-bold mb-4 text-center">Your Lore is ready</h2>
              <div className="mb-4">
                <iframe
                  src="https://www.tiktok.com/embed/v2/7529586683185040662"
                  width="100%"
                  height="400"
                  allowFullScreen
                  className="rounded-lg"
                />
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-full text-lg"
              >
                Purchase your Lore Video
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
