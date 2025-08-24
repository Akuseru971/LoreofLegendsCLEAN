// pages/gallery.js
import Head from "next/head";
import Image from "next/image";
import { galleryItems } from "../data/gallery";

export default function Gallery() {
  return (
    <>
      <Head>
        <title>Gallery - Lore of Legends</title>
      </Head>
      <div className="min-h-screen bg-black text-white px-4 py-10">
        <h1 className="text-3xl font-bold text-center mb-10">
          Champion Gallery
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900 rounded-lg overflow-hidden shadow-lg"
            >
              <Image
                src={item.image}
                alt={item.name}
                width={400}
                height={400}
                className="object-cover w-full h-48"
              />
              <div className="p-3 text-center font-semibold">{item.name}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
