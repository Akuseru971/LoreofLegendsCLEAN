// pages/index.js
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Script from 'next/script';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import * as ReactDOM from 'react-dom';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function TopLoreCarousel({ items }) {
  return (
    <div className="w-full flex flex-col items-center mt-10">
      <h2 className="text-2xl font-bold mb-4">Top Lore of the Week</h2>
      <div className="w-full max-w-5xl overflow-x-auto">
        <div className="flex gap-4 px-1">
          {items.map((item) => (
            <div
              key={item.name}
              className="min-w-[300px] bg-black/50 rounded-2xl p-3 backdrop-blur overflow-hidden shadow-lg"
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster={item.poster}
                className="w-[280px] h-[160px] object-cover rounded-xl"
              >
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

/** Portal monté dans <body> pour éviter tout stacking/overflow parent */
function PopupPortal({ children }) {
  const [mounted, setMounted] = useState(false);

  const container = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const el = document.createElement('div');
    el.setAttribute('id', 'popup-root');
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '999999';
    return el;
  }, []);

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    setMounted(true);
    return () => {
      try { document.body.removeChild(container); } catch {}
    };
  }, [container]);

  if (!mounted || !container) return null;
  return ReactDOM.createPortal(children, container);
}

export default function Home() {
  const [pseudo, setPseudo] = useState('');
  const [genre, setGenre] = useState('Man');
  const [role, setRole] = useState('Top');
  const [lore, setLore] = useState('');
  const [displayedLore, setDisplayedLore] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('bundle'); // 'bundle' | 'image_only'
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
    const response = await fetch('/api/generate-lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, genre, role }),
    });
    const data = await response.json();
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
    const formattedLore = words.map((w, i) => ((i + 1) % 11 === 0 ? w + '\n' : w)).join(' ');
    let i = 0;
    const it = setInterval(() => {
      setDisplayedLore((prev) => prev + formattedLore.charAt(i));
      i++;
      if (i >= formattedLore.length) clearInterval(it);
    }, 12);
    return () => clearInterval(it);
  }, [lore]);

  // === UPDATED: accepts productType ('bundle' | 'image_only') ===
  const handleCheckout = async (productType = 'bundle') => {
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        alert('Stripe failed to load on this device.');
        return;
      }
      let loreRaw = lore || '';
      let pseudoToSend = pseudo || '';
      let genreToSend = genre || '';
      let roleToSend  = role  || '';

      try {
        if (!loreRaw && typeof window !== 'undefined') {
          loreRaw = localStorage.getItem('lastLore') || '';
        }
        if (!pseudoToSend && typeof window !== 'undefined') {
          pseudoToSend = localStorage.getItem('lastPseudo') || '';
        }
        if (!genreToSend && typeof window !== 'undefined') {
          genreToSend = localStorage.getItem('lastGenre') || '';
        }
        if (!roleToSend && typeof window !== 'undefined') {
          roleToSend = localStorage.getItem('lastRole') || '';
        }
      } catch {}

      if (!loreRaw) {
        const domText = loreSpanRef.current?.textContent?.trim() || '';
        if (domText) {
          loreRaw = domText.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
        }
      }
      if (!loreRaw && displayedLore) {
        loreRaw = displayedLore.trim();
      }

      // For image-only we still allow empty lore (if you prefer, enforce it)
      if (productType !== 'image_only' && !loreRaw) {
        alert('Please generate your lore first before purchasing.');
        return;
      }

      const b64 = typeof window !== 'undefined'
        ? btoa(unescape(encodeURIComponent(loreRaw || '')))
        : '';

      const payload = {
        pseudo: pseudoToSend,
        genre: genreToSend,
        role: roleToSend,
        lore: loreRaw || '',
        loreDisplay: (displayedLore || '').trim(),
        productType, // NEW
      };

      console.log('Checkout payload (front):', {
        ...payload,
        loreLen: payload.lore.length,
        head: payload.lore.slice(0, 80),
      });

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
        console.warn('redirectToCheckout error, fallback to URL if present:', error);
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
      console.error('handleCheckout exception:', e);
      alert(e?.message || 'Unexpected error starting checkout.');
    }
  };

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
      setShowPopup(true);
    }
  };

  return (
    <>
      <div className="relative min-h-screen w-full text-white font-serif">
        <Head><title>Lore of Legends</title></Head>
        <Script src="https://js.stripe.com/v3" strategy="afterInteractive" />
        <video autoPlay loop muted className="absolute top-0 left-0 w-full h-full object-cover z-0">
          <source src="/background.mp4" type="video/mp4" />
        </video>
        <div className="absolute top-0 left-0 w-full h-full bg-black/60 z-10" />

        {/* Logo fixe en haut à gauche (retour accueil) */}
        <div className="fixed top-4 left-4 z-[1000000]">
          <Link href="/" passHref>
            <Image
              src="/logo.png"
              alt="Lore of Legends"
              width={56}
              height={56}
              className="cursor-pointer rounded-full ring-1 ring-white/20 hover:ring-white/40 hover:scale-105 transition"
            />
          </Link>
        </div>

        <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4">
          <Image src="/logo.png" alt="Logo" width={160} height={160} className="mb-2" />

          <div className="mb-6">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold
                         bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border border-white/20
                         hover:from-indigo-500/50 hover:to-purple-500/50 hover:shadow-lg transition"
            >
              <span>🏛️ Visit the Hall of Legends</span>
              <span aria-hidden>→</span>
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-4 text-white">Generate your Runeterra Lore</h1>

          {/* Optional small price chooser */}
          <div className="mb-4 text-sm flex gap-2">
            <button
              onClick={() => setSelectedProduct('bundle')}
              className={`px-3 py-1 rounded-full border ${
                selectedProduct === 'bundle'
                  ? 'bg-white/20 border-white'
                  : 'bg-white/10 border-white/30 hover:bg-white/20'
              }`}
              title="Lore Video + Image (8,99€)"
            >
              Lore + Image · 8,99€
            </button>
            <button
              onClick={() => setSelectedProduct('image_only')}
              className={`px-3 py-1 rounded-full border ${
                selectedProduct === 'image_only'
                  ? 'bg-white/20 border-white'
                  : 'bg-white/10 border-white/30 hover:bg-white/20'
              }`}
              title="Image Only (2,99€)"
            >
              Image only · 2,99€
            </button>
          </div>

          <div className="bg-black/40 p-6 rounded-lg w-15 max-w-sm space-y-4">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-14 p-3 rounded-[18px] w-full bg-white text-black">
              <option>Man</option><option>Woman</option><option>Creature</option>
            </select>
            <input
              type="text"
              placeholder="Enter your Summoner Name"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              className="h-14 p-3 rounded-[18px] w-full text-black"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-14 p-3 rounded-[18px] w-full bg-white text-black">
              <option>Top</option><option>Mid</option><option>Jungle</option><option>ADC</option><option>Support</option>
            </select>
            <button onClick={handleGenerate} className="h-14 bg-blue-600 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-[18px] w-full">
              {loading ? 'Generating...' : 'Generate My Lore'}
            </button>
          </div>

          {!lore && <TopLoreCarousel items={topLore} />}

          {lore && (
            <div className="mt-24 w-full flex flex-col items-center justify-center animate-fade-in px-4">
              <div
                className="lore-box bg-black text-white p-4 sm:p-6 rounded-lg
                           w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl
                           text-left leading-relaxed shadow-lg mb-6
                           box-border break-words min-w-0"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', hyphens: 'auto' }}
              >
                <span ref={loreSpanRef} className="whitespace-pre-line break-words">
                  {displayedLore}
                </span>
              </div>
              <button
                className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-[18px]"
                onClick={openPreview}
              >
                Generate your Lore Video
              </button>
              <TopLoreCarousel items={topLore} />
            </div>
          )}
        </div>
      </div>

      {showPopup && !isIOS && (
        <PopupPortal>
          <div className="fixed inset-0 z-[999999] flex items-start justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-[92vw] max-w-md md:max-w-xl p-2 sm:p-4">
              <div className="relative bg-gray-900 text-white rounded-lg shadow-xl" style={{ marginTop: 'max(env(safe-area-inset-top), 6px)' }} role="dialog" aria-modal="true">
                <button className="absolute top-2 right-2 text-white text-2xl leading-none" onClick={() => setShowPopup(false)} aria-label="Close">✖</button>
                <h2 className="text-lg md:text-xl font-bold text-center pt-3 px-4">Your Lore is ready</h2>
                <div className="px-4 pb-3 mt-2 overflow-y-auto" style={{ maxHeight: '64vh' }}>
                  <div className="rounded overflow-hidden">
                    <iframe
                      src="https://www.tiktok.com/embed/v2/7529586683185040662"
                      className="w-full h-[42vh] md:h-[58vh] rounded"
                      allow="autoplay; fullscreen; clipboard-write"
                      allowFullScreen
                    />
                  </div>
                </div>

                {/* Two CTAs */}
                <div className="px-4 pb-4 pt-2 space-y-2">
                  <button
                    onClick={() => handleCheckout('bundle')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-[18px] text-lg"
                    title="Lore Video + Image (8,99€)"
                  >
                    Buy Lore Video + Image · 8,99€
                  </button>
                  <button
                    onClick={() => handleCheckout('image_only')}
                    className="w-full bg-emerald-600/90 hover:bg-emerald-700 text-white font-semibold py-3 rounded-[18px]"
                    title="Image Only (2,99€)"
                  >
                    Buy Image Only · 2,99€
                  </button>
                </div>
              </div>
            </div>
          </div>
        </PopupPortal>
      )}
    </>
  );
}
