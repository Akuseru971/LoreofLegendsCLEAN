// pages/gallery.js
import Head from "next/head";
import Image from "next/image";
import { galleryItems } from "../data/gallery";

export default function Gallery() {
  return (
    <>
      <Head>
        <title>Gallery — Lore of Legends</title>
      </Head>

      <div className="min-h-screen bg-black text-white px-4 py-10">
        <h1 className="text-3xl font-bold text-center mb-10">Hall of Legends</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className="bg-white/10 border border-white/10 rounded-xl overflow-hidden shadow-lg
                         hover:shadow-xl hover:scale-[1.02] transition-transform"
            >
              {/* Bloc image responsive */}
              <div className="relative w-full" style={{ paddingTop: '100%' }}>
                <Image
                  src={item.image}              // ex: /champions/Leviathan.jpg
                  alt={item.name}
                  fill                            // occupe tout le parent
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={false}
                />
              </div>

              <div className="p-3 text-center font-semibold truncate">{item.name}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
