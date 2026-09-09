"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Teacher {
  id: string;
  order: number;
  name: string;
  subject: string;
  role: string;
  phone: string;
  email: string;
  notes?: string;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#b45309,#fbbf24)",
  "linear-gradient(135deg,#0e7490,#22d3ee)",
  "linear-gradient(135deg,#065f46,#34d399)",
  "linear-gradient(135deg,#9d174d,#f472b6)",
  "linear-gradient(135deg,#1e3a5f,#3b82f6)",
  "linear-gradient(135deg,#4a1942,#c084fc)",
  "linear-gradient(135deg,#92400e,#fbbf24)",
  "linear-gradient(135deg,#134e4a,#2dd4bf)",
  "linear-gradient(135deg,#7c2d12,#fb923c)",
  "linear-gradient(135deg,#1e3a5f,#60a5fa)",
];

function waLink(phone: string) {
  const num = "972" + phone.replace(/\D/g, "").replace(/^0/, "");
  return `https://wa.me/${num}`;
}

const WaIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChevronIcon = () => (
  <svg className="teacher-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function Teachers({ classId }: { classId: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "teachers"),
      orderBy("order")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTeachers(
          snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as Teacher))
            .filter((t) => t.name?.trim())
        );
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [classId]);

  if (loading) return <p className="text-muted-foreground text-center py-5">טוען צוות מורים...</p>;
  if (error)   return <p className="text-red-400 text-center py-5">שגיאה בטעינת צוות המורים</p>;
  if (teachers.length === 0) return <p className="text-muted-foreground text-center py-5">אין נתונים</p>;

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="teachers-grid">
      {teachers.map((t, i) => {
        const isOpen = openId === t.id;
        return (
          <div
            key={t.id}
            className={`teacher-card${isOpen ? " open" : ""}`}
            onClick={() => toggle(t.id)}
          >
            <div className="teacher-top">
              <div
                className="teacher-avatar"
                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {t.name.charAt(0)}
              </div>
              <div className="teacher-info">
                <div className="teacher-name">{t.name}</div>
                {t.subject && <div className="teacher-subject">{t.subject}</div>}
                {t.role && <div className="homeroom-badge">{t.role}</div>}
              </div>
              <ChevronIcon />
            </div>

            <div className="teacher-contact" onClick={(e) => e.stopPropagation()}>
              {t.phone ? (
                <a className="teacher-wa" href={waLink(t.phone)} target="_blank" rel="noopener noreferrer">
                  <WaIcon /> {t.phone}
                </a>
              ) : null}
              {t.email ? (
                <a className="teacher-email" href={`mailto:${t.email}`}>
                  <MailIcon /> {t.email}
                </a>
              ) : null}
              {t.notes ? (
                <div className="teacher-notes">
                  <ClockIcon />
                  <span>{t.notes}</span>
                </div>
              ) : null}
              {!t.phone && !t.email && !t.notes ? (
                <a className="teacher-mashov" href="https://web.mashov.info/parents/main/home" target="_blank" rel="noopener noreferrer">
                  פנייה דרך המשוב
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
