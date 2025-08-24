// pages/index.js (imports du haut)
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Script from 'next/script';
import Link from 'next/link';          // ← AJOUT ICI
import { loadStripe } from '@stripe/stripe-js';
import * as ReactDOM from 'react-dom';

{/* Mini-nav sous le logo */}
<div className="mb-6">
  <Link
    href="/gallery"
    className="group relative inline-flex items-center gap-2 rounded-full px-5 py-2.5
               text-sm font-semibold text-white
               bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500
               hover:from-indigo-400 hover:via-fuchsia-400 hover:to-pink-400
               transition-all duration-200
               shadow-[0_8px_30px_rgba(99,102,241,0.45)]
               focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ring-offset-black"
    aria-label="Visit the Hall of Legends"
  >
    {/* Glow subtil au survol */}
    <span
      className="pointer-events-none absolute inset-0 rounded-full bg-white/10 blur-md
                 opacity-0 group-hover:opacity-100 transition-opacity"
      aria-hidden="true"
    />

    {/* Icône trophée */}
    <svg
      className="h-4 w-4 opacity-90 group-hover:opacity-100"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 21h8v-2H8v2Zm4-4a5 5 0 0 0 5-5V5h1a2 2 0 1 0 0-4H6a2 2 0 1 0 0 4h1v7a5 5 0 0 0 5 5Zm-7-14h1v3.5A3.5 3.5 0 0 1 2.5 3 1.5 1.5 0 0 1 5 3Zm12 3.5V3h1a1.5 1.5 0 1 1 0 3A3.5 3.5 0 0 1 17 6.5Z"/>
    </svg>

    <span>Visit the Hall of Legends</span>

    {/* Petite flèche animée */}
    <svg
      className="h-4 w-4 translate-x-0 group-hover:translate-x-0.5 transition-transform"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  </Link>
</div>
