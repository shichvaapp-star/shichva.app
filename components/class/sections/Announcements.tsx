"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

interface Announcement {
  id: string;
  order: number;
  date: string;
  title: string;
  body?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: "image" | "pdf";
  linkUrl?: string;
  linkTitle?: string;
  important: boolean;
  hidden?: boolean;
}

function openPdf(url: string) {
  if (!url) return;
  if (url.startsWith("data:")) {
    try {
      const base64Data = url.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (e) {
      console.error("Failed to decode base64 PDF:", e);
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

export default function Announcements({ classId }: { classId: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "announcements"),
      orderBy("order")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Announcement))
          .filter((ann) => !ann.hidden)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setItems(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [classId]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-center py-5">טוען הודעות...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-center py-5">שגיאה בטעינת הודעות</p>;
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-5">אין הודעות כרגע</p>;
  }

  return (
    <>
      <div className="space-y-2.5">
        {items.map((ann) => {
          const hasContent = Boolean(
            ann.body?.trim() || ann.imageUrl || ann.fileUrl || ann.linkUrl?.trim()
          );
          const isExpanded = expandedIds.has(ann.id);

          return (
            <div
              key={ann.id}
              className={`border-r-[3px] rounded-xl px-4 py-3.5 transition-all duration-150 ${
                ann.important
                  ? "border-red-500 bg-red-500/[0.07]"
                  : "border-[var(--theme-accent)] bg-[var(--card-bg)] border-y border-l border-y-[var(--card-border)] border-l-[var(--card-border)]"
              }`}
            >
              <div
                className={`flex items-start justify-between gap-3 ${
                  hasContent ? "cursor-pointer select-none group" : ""
                }`}
                onClick={() => hasContent && toggleExpand(ann.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">{ann.date}</div>
                  <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                    {ann.important && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                    <span
                      className={
                        hasContent
                          ? "group-hover:text-[var(--theme-accent)] transition-colors"
                          : ""
                      }
                    >
                      {ann.title}
                    </span>
                  </div>
                </div>

                {hasContent && (
                  <button
                    type="button"
                    className="p-1 rounded-lg text-muted-foreground group-hover:text-foreground group-hover:bg-white/5 transition-all mt-0.5 cursor-pointer"
                    aria-label={isExpanded ? "כווץ הודעה" : "הרחב הודעה"}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-[var(--theme-accent)]" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              {hasContent && isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3 animate-in fade-in duration-200">
                  {ann.body && (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {ann.body}
                    </p>
                  )}

                  {/* External Website Link */}
                  {ann.linkUrl && (
                    <div className="mt-2.5 flex justify-start w-full">
                      <a
                        href={
                          ann.linkUrl.startsWith("http://") || ann.linkUrl.startsWith("https://")
                            ? ann.linkUrl
                            : `https://${ann.linkUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 dark:bg-violet-500/15 dark:hover:bg-violet-500/25 border border-violet-500/30 text-violet-700 dark:text-violet-200 transition-all text-xs font-semibold shadow-xs group cursor-pointer"
                      >
                        <span className="text-sm">🔗</span>
                        <span>{ann.linkTitle || "מעבר לאתר / קישור מצורף"}</span>
                        <span className="text-[10px] opacity-70 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-transform">
                          ↗
                        </span>
                      </a>
                    </div>
                  )}

                  {(() => {
                    const fileUrl = ann.imageUrl || ann.fileUrl;
                    if (!fileUrl) return null;

                    const isPdf =
                      ann.fileType === "pdf" ||
                      fileUrl.includes(".pdf") ||
                      fileUrl.startsWith("data:application/pdf");

                    if (isPdf) {
                      return (
                        <div className="mt-2.5 flex justify-center sm:justify-start w-full">
                          <button
                            type="button"
                            onClick={() => openPdf(fileUrl)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 border border-purple-500/30 text-purple-700 dark:text-purple-200 transition-all text-xs font-semibold shadow-xs group cursor-pointer"
                          >
                            <span className="text-base text-red-500">📄</span>
                            <span>{ann.fileName || "צפייה במכתב / מסמך מצורף (PDF)"}</span>
                            <span className="text-[10px] opacity-70 group-hover:opacity-100">↗</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-2.5 flex justify-center sm:justify-start w-full">
                        <div
                          className="relative w-full max-w-[220px] sm:max-w-[260px] h-28 sm:h-36 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 cursor-pointer group shadow-xs"
                          onClick={() => setLightboxImage({ url: fileUrl, title: ann.title })}
                          title="לחץ להגדלה"
                        >
                          <Image
                            src={fileUrl}
                            alt={ann.title}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 220px, 260px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full backdrop-blur-xs">
                              🔍 לחץ להגדלה
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
              aria-label="סגור"
            >
              ✕
            </button>
            <div className="lightbox-img-wrap">
              <Image
                src={lightboxImage.url}
                alt={lightboxImage.title}
                fill
                unoptimized
                sizes="90vw"
                className="object-contain"
              />
            </div>
            {lightboxImage.title && (
              <p className="lightbox-caption">{lightboxImage.title}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
