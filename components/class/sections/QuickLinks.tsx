"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  QuickLinkItem,
  FeaturedLinkItem,
  DEFAULT_LINKS,
  DEFAULT_FEATURED,
} from "@/components/admin/tabs/AdminLinks";

interface Props {
  classId?: string;
}

export default function QuickLinks({ classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2" }: Props) {
  const [links, setLinks] = useState<QuickLinkItem[]>([]);
  const [featured, setFeatured] = useState<FeaturedLinkItem>(DEFAULT_FEATURED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const colRef = collection(db, "classes", classId, "links");
    const q = query(colRef, orderBy("order", "asc"));

    const unsubLinks = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const list: QuickLinkItem[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<QuickLinkItem, "id">) });
          });
          setLinks(list);
        } else {
          // Fallback to default links
          setLinks(
            DEFAULT_LINKS.map((d, index) => ({
              id: `default-${index}`,
              ...d,
            }))
          );
        }
        setLoaded(true);
      },
      (err) => {
        console.warn("Error fetching quick links, using defaults:", err);
        setLinks(
          DEFAULT_LINKS.map((d, index) => ({
            id: `default-${index}`,
            ...d,
          }))
        );
        setLoaded(true);
      }
    );

    const featuredDocRef = doc(db, "classes", classId, "meta", "featuredLink");
    const unsubFeatured = onSnapshot(
      featuredDocRef,
      (snap) => {
        if (snap.exists()) {
          setFeatured(snap.data() as FeaturedLinkItem);
        } else {
          setFeatured(DEFAULT_FEATURED);
        }
      },
      (err) => {
        console.warn("Error fetching featured link:", err);
        setFeatured(DEFAULT_FEATURED);
      }
    );

    return () => {
      unsubLinks();
      unsubFeatured();
    };
  }, [classId]);

  const displayLinks = loaded && links.length > 0 ? links : DEFAULT_LINKS.map((d, i) => ({ id: `default-${i}`, ...d }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayLinks.map((link) => (
          <a
            key={link.id || link.url + link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2.5 py-4 px-3 rounded-xl text-sm font-bold text-foreground bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/[0.06] dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-200 text-center shadow-xs group"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={link.icon}
                alt={link.label}
                className="w-7 h-7 object-contain rounded-md group-hover:scale-105 transition-transform duration-200"
                style={link.invertIcon ? { filter: "var(--logo-filter)" } : undefined}
                loading="lazy"
              />
            </div>
            <span className="line-clamp-1 text-xs sm:text-sm">{link.label}</span>
          </a>
        ))}
      </div>

      {featured && featured.enabled !== false && (
        <a
          href={featured.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 py-5 px-4 rounded-xl font-bold text-foreground border border-purple-500/30 hover:border-purple-400/60 transition-all duration-200 shadow-sm"
          style={{
            background: "linear-gradient(135deg, rgba(109,40,217,0.2) 0%, rgba(67,56,202,0.15) 100%)",
          }}
        >
          {featured.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featured.icon}
              alt={featured.label}
              className="w-8 h-8 object-contain rounded"
              style={featured.invertIcon ? { filter: "var(--logo-filter)" } : undefined}
              loading="lazy"
            />
          )}
          <div className="flex flex-col items-start">
            <span className="text-base font-bold">{featured.label}</span>
            {featured.sublabel && (
              <span className="text-xs text-muted-foreground">{featured.sublabel}</span>
            )}
          </div>
        </a>
      )}
    </div>
  );
}

