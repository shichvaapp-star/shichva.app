"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  createdAt: number;
}

export default function Gallery({ classId }: { classId: string }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "classes", classId, "gallery"), orderBy("createdAt", "desc")))
      .then((snap) => {
        setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto)));
        setLoading(false);
      });
  }, [classId]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, photos.length]);

  function prev() { setCurrent((c) => (c - 1 + photos.length) % photos.length); }
  function next() { setCurrent((c) => (c + 1) % photos.length); }

  if (loading || photos.length === 0) return null;

  const photo = photos[current];

  return (
    <>
      <section id="gallery" className="py-16 border-t border-white/10">
        <h2 className="text-2xl font-bold text-foreground mb-6">גלריה</h2>

        <div className="carousel-wrap">
          {/* Main image */}
          <div className="carousel-main" onClick={() => setLightbox(true)}>
            <Image
              key={photo.id}
              src={photo.url}
              alt={photo.caption || "תמונה"}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover carousel-img"
              priority
            />
            {/* Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  className="carousel-arrow carousel-arrow-prev"
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  aria-label="הקודם"
                >
                  ›
                </button>
                <button
                  className="carousel-arrow carousel-arrow-next"
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  aria-label="הבא"
                >
                  ‹
                </button>
              </>
            )}
            {/* Caption */}
            {photo.caption && (
              <div className="carousel-caption">{photo.caption}</div>
            )}
          </div>

          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="carousel-dots">
              {photos.map((_, i) => (
                <button
                  key={i}
                  className={`carousel-dot${i === current ? " active" : ""}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`תמונה ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="carousel-thumbs">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  className={`carousel-thumb-item${i === current ? " active" : ""}`}
                  onClick={() => setCurrent(i)}
                >
                  <Image
                    src={p.url}
                    alt={p.caption || "תמונה"}
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(false)}>
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(false)}>✕</button>
            {photos.length > 1 && (
              <button className="lightbox-arrow lightbox-arrow-prev" onClick={next}>›</button>
            )}
            <div className="lightbox-img-wrap">
              <Image
                src={photo.url}
                alt={photo.caption || "תמונה"}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            {photos.length > 1 && (
              <button className="lightbox-arrow lightbox-arrow-next" onClick={prev}>‹</button>
            )}
            {photo.caption && <p className="lightbox-caption">{photo.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}
