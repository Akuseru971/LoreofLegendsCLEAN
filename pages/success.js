// pages/success.js
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function Success() {
  const [status, setStatus] = useState('Processing your order…');

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');

    // Récup lore depuis localStorage (fallback si besoin)
    let lore = localStorage.getItem('lastLore') || '';
    let pseudo = localStorage.getItem('lastPseudo') || '';
    let genre  = localStorage.getItem('lastGenre')  || '';
    let role   = localStorage.getItem('lastRole')   || '';

    // Si vraiment vide, essaye un dernier fallback depuis l’écran (optionnel)
    if (!lore) {
      const span = document.querySelector('.lore-box span');
      const domText = span?.textContent?.trim() || '';
      if (domText) lore = domText.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
    }

    async function fulfill() {
      try {
        const resp = await fetch('/api/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, lore, pseudo, genre, role }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.error('fulfill error:', data);
          setStatus(data?.error || 'There was a problem fulfilling your order.');
          return;
        }
        setStatus('✅ Your order is confirmed. Check your inbox!');
      } catch (e) {
        console.error('fulfill exception:', e);
        setStatus(e?.message || 'Unexpected error.');
      }
    }

    if (sessionId && lore) {
      fulfill();
    } else if (!sessionId) {
      setStatus('Missing session id.');
    } else {
      setStatus('No lore found to send. Please contact support.');
    }
  }, []);

  return (
    <>
      <Head><title>Order Success</title></Head>
      <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
        <p>{status}</p>
      </div>
    </>
  );
}
