// pages/preview.js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Preview() {
  const router = useRouter();
  const { pseudo = "" } = router.query;

  const [displayedLore, setDisplayedLore] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastLore = localStorage.getItem("lastLore") || "";
      setDisplayedLore(lastLore);
    }
  }, []);

  const handleCheckout = async (mode) => {
    try {
      const loreRaw =
        displayedLore || localStorage.getItem("lastLore") || "";

      if (!loreRaw) {
        alert("Please generate your lore first before purchasing.");
        return;
      }

      const payload = {
        pseudo: pseudo || localStorage.getItem("lastPseudo") || "",
        genre: localStorage.getItem("lastGenre") || "",
        role: localStorage.getItem("lastRole") || "",
        lore: loreRaw,
      };

      const resp = await fetch("/api/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          mode, // "video" ou "image"
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("checkout-session error:", data);
        alert(data?.error || "Server error creating checkout session.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("No checkout URL received.");
      }
    } catch (e) {
      console.error("handleCheckout exception:", e);
      alert(e?.message || "Unexpected error.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">
      <h1 className="text-2xl font-bold mb-6">Your Lore Preview</h1>
      <div className="bg-gray-900 p-4 rounded-lg max-w-xl w-full mb-6">
        <pre className="whitespace-pre-wrap">{displayedLore}</pre>
      </div>

      {/* Deux boutons distincts */}
      <div className="space-y-4 w-full max-w-sm">
        <button
          onClick={() => handleCheckout("video")}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-[18px] text-lg"
        >
          Purchase My Lore Video + Splash art (8.99€)
        </button>
        <button
          onClick={() => handleCheckout("image")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-[18px] text-lg"
        >
          Purchase My Champion Splash Art (2.99€)
        </button>
      </div>
    </div>
  );
}
