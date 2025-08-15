// pages/index.js
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Script from 'next/script';
import { loadStripe } from '@stripe/stripe-js';
import * as ReactDOM from 'react-dom';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// --- Carrousel ---
function TopLoreCarousel({ items }) {
  return (
    <div className="w-full flex flex-col items-center mt-10">
      <h2 className="text-2xl font-bold mb-4">Top Lore of the Week</h2>
      <div className="w-full max-w-5xl overflow-x-auto">
        <div className="flex gap-4 px-1">
          {items.map((item) => (
            <div key={item.name} className="min-w-[300px] bg-black/50 rounded-2xl p-3 backdrop-blur overflow-hidden shadow-lg">
              <video autoPlay loop muted playsInline preload="metadata" poster={item.poster} className="w-[280px] h-[160px] object-cover rounded-xl">
                <source src={item.video} type="video/mp4" />
              </video>
              <p className="mt-3 font-semibold text-center">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Portal (desktop/Android) ---
function PopupPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  const el = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const div = document.createElement('div');
    div.id = 'popup-root';
    div.style.zIndex = '9999'; // z-index max
    return div;
  }, []);
  useEffect(() => {
    if (!el) return;
    document.body.appendChild(el);
    setMounted(true);
    return () => { try { document.body.removeChild(el); } catch {} };
  }, [el]);
  if (!mounted || !el) return null;
  return ReactDOM.createPortal(children, el);
}

export default function Home() {
  const [pseudo, setPseudo] = useState('');
  const [genre, setGenre] = useState('Man');
  const [role, setRole] = useState('Top');
  const [lore, setLore] = useState('');
  const [displayedLore, setDisplayedLore] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const loreSpanRef = useRef(null);

  const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

  const topLore = [
    { name: 'Akuseru', video: '/top-lore/Akuseru.mp4', poster: '/top-lore/Akuseru.png' },
    { name: 'Soukoupaks', video: '/top-lore/Soukoupaks.mp4', poster: '/top-lore/Soukoupaks.png' },
    { name: 'Gabybixx', video: '/top-lore/Gabybixx.mp4', poster: '/top-lore/Gabybixx.png' },
    { name: 'Kintesence', video: '/top-lore/Kintesence.mp4', poster: '/top-lore/Kintesence.png' },
    { name: 'Kitou', video: '/top-lore/Kitou.mp4', poster: '/top-lore/Kitou.png' },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setLore('');
    setDisplayedLore('');
    setShowPopup(false);
    const res = await fetch('/api/generate-lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, genre, role }),
    });
    const data = await res.json();
    const generated = data.lore || '';
    setLore(generated);
    setLoading(false);
    try {
      localStorage.setItem('lastLore', generated);
      localStorage.setItem('lastPseudo', pseudo || '');
      localStorage.setItem('lastGenre', genre || '');
      localStorage.setItem('lastRole', role || '');
    } catch {}
  };

  useEffect(() => {
    if (!lore) return;
    const words = lore.split(' ');
    const formatted = words.map((w, i) => ((i + 1) % 11 === 0 ? w + '\n' : w)).join(' ');
    let i = 0;
    const it = setInterval(() => {
      setDisplayedLore((prev) => prev + formatted.charAt(i));
      i++;
      if (i >= formatted.length) clearInterval(it);
    }, 12);
    return () => clearInterval(it);
  }, [lore]);

  // ESC pour fermer (desktop/Android)
  useEffect(() => {
    if (!showPopup || isIOS) return;
    const onKey = (e) => e.key === 'Escape' && setShowPopup(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPopup, isIOS]);

  const handleCheckout = async () => {
    try {
      const stripe = await stripePromise;
      if (!stripe) return alert('Stripe failed to load on this device.');
      let loreRaw = lore || '';
      let pseudoToSend = pseudo || '';
      let genreToSend = genre || '';
      let roleToSend  = role  || '';
      try {
        if (!loreRaw) loreRaw = localStorage.getItem('lastLore') || '';
        if (!pseudoToSend) pseudoToSend = localStorage.getItem('lastPseudo') || '';
        if (!genreToSend) genreToSend = localStorage.getItem('lastGenre') || '';
        if (!roleToSend) roleToSend = localStorage.getItem('lastRole') || '';
      } catch {}
      if (!loreRaw) {
        const domText = loreSpanRef.current?.textContent?.trim() || '';
        if (domText) loreRaw = domText.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
      }
      if (!loreRaw && displayedLore) loreRaw = displayedLore.trim();
      if (!loreRaw) return alert('Please generate your lore first before purchasing.');

      const b64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(loreRaw))) : '';
      const resp = await fetch('/api/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lore-b64': b64 },
        body: JSON.stringify({
          pseudo: pseudoToSend,
          genre: genreToSend,
          role: roleToSend,
          lore: loreRaw,
          loreDisplay: (displayedLore || '').trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error('checkout-session error:', data);
        return alert(data?.error || 'Server error creating checkout session.');
      }
      if (data?.id) {
        const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
        if (!error) return;
        if (data?.url) return (window.location.href = data.url);
        return alert(error.message || 'Unable to open Stripe Checkout.');
      }
      if (data?.url) return (window.location.href = data.url);
      alert('No session returned by server.');
    } catch (e) {
      console.error('handleCheckout exception:', e);
      alert(e?.message || 'Unexpected error starting checkout.');
    }
  };

  // Empêche le scroll du fond quand popup ouverte (desktop/Android)
  useEffect(() => {
    if (showPopup && !isIOS) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev || ''; };
    }
  }, [showPopup, isIOS]);

  const openPreview = () => {
    if (isIOS) {
      window.location.href = `/preview?pseudo=${encodeURIComponent(pseudo || '')}`;
    } else {
      console.log('Open preview (desktop): setShowPopup(true)');
      setShowPopup(true);
    }
  };

  return (
    <>
      <div className="relative min-h-screen w-full overflow-hidden text-white font-serif">
        <Head><title>Lore of Legends</title></Head>
        <Script src="https://js.stripe.com/v3" strategy="afterInteractive" />
        <video autoPlay loop muted className="absolute top-0 left-0 w-full h-full object-cover z-0">
          <source src="/background.mp4" type="video/mp4" />
        </video>
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-60 z-10" />
        <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4">
          <Image src="/logo.png" alt="Logo" width={160} height={160} className="mb-4" />
          <h1 className="text-3xl font-bold mb-6 text-white">Generate your Runeterra Lore</h1>

          <div className="bg-black bg-opacity-40 p-6 rounded-lg backdrop-blur w-15 max-w-sm space-y-4">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-14 p-3 rounded-[18px] w-full bg-white text-black">
              <option>Man</option><option>Woman</option><option>Creature</option>
            </select>
            <input type="text" placeholder="Enter your Summoner Name" value={pseudo} onChange={(e) => setPseudo(e.target.value)} className="h-14 p-3 rounded-[18px] w-full text-black" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-14 p-3 rounded-[18px] w-full bg-white text-black">
              <option>Top</option><option>Mid</option><option>Jungle</option><option>ADC</option><option>Support</option>
            </select>
            <button onClick={handleGenerate} className="h-14 bg-blue-600 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-[18px] w-full">
              {loading ? 'Generating...' : 'Generate My Lore'}
            </button>
          </div>

          {!lore && <TopLoreCarousel items={topLore} />}

          {lore && (
            <div className="mt-24 w-fit flex flex-col items-center justify-center animate-fade-in">
              <div className="lore-box bg-black text-white p-6 rounded-lg w-fit text-center text-md leading-relaxed shadow-lg mb-6">
                <span ref={loreSpanRef} className="whitespace-pre-line">{displayedLore}</span>
              </div>
              <button className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-[18px]" onClick={openPreview}>
                Generate your Lore Video
              </button>
              <TopLoreCarousel items={topLore} />
            </div>
          )}
        </div>
      </div>

      {/* Popup via Portal (desktop/Android uniquement) */}
      {showPopup && !isIOS && (
        <PopupPortal>
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-start justify-center overflow-y-auto" role="dialog" aria-modal="true">
            <div className="w-[92vw] max-w-md md:max-w-xl p-2 sm:p-4">
              <div className="relative bg-gray-900 text-white rounded-lg shadow-xl" style={{ marginTop: 'max(env(safe-area-inset-top), 6px)' }}>
                <button className="absolute top-2 right-2 text-white text-2xl leading-none" onClick={() => setShowPopup(false)} aria-label="Close">✖</button>
                <h2 className="text-lg md:text-xl font-bold text-center pt-3 px-4">Your Lore is ready</h2>
                <div className="px-4 pb-3 mt-2 overflow-y-auto" style={{ maxHeight: '64vh' }}>
                  <div className="rounded overflow-hidden">
                    <iframe src="https://www.tiktok.com/embed/v2/7529586683185040662" className="w-full h-[42vh] md:h-[58vh] rounded" allow="autoplay; fullscreen; clipboard-write" allowFullScreen />
                  </div>
                </div>
                <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-gray-900/95 backdrop-blur rounded-b-lg">
                  <button onClick={handleCheckout} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-[18px] text-lg">Purchase your Lore Video</button>
                </div>
              </div>
            </div>
          </div>
        </PopupPortal>
      )}
    </>
  );
}
/ /   b u m p  
 