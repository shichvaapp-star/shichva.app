"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ClassNav from "@/components/class/ClassNav";
import Announcements from "@/components/class/sections/Announcements";
import Schedule from "@/components/class/sections/Schedule";
import Events from "@/components/class/sections/Events";
import Seating from "@/components/class/sections/Seating";
import Teachers from "@/components/class/sections/Teachers";
import QuickLinks from "@/components/class/sections/QuickLinks";
import EmergencySchedule from "@/components/class/sections/EmergencySchedule";
import Gallery from "@/components/class/sections/Gallery";
import ThemeInitializer from "@/components/class/ThemeInitializer";
import AuthGate from "@/components/auth/AuthGate";
import { ClassSettings } from "@/components/admin/tabs/AdminSettings";

interface Props {
  classId: string;
}

function ClassBackground({ bgStyle }: { bgStyle?: "geometric" | "grid" | "stars" | "minimal" }) {
  if (bgStyle === "minimal") {
    return null;
  }

  if (bgStyle === "grid") {
    return (
      <div aria-hidden="true" className="geo-bg">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--theme-svg-accent-1)" strokeWidth="0.8" />
              <circle cx="40" cy="40" r="1.5" fill="var(--theme-svg-accent-2)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tech-grid)" />
        </svg>
      </div>
    );
  }

  if (bgStyle === "stars") {
    return (
      <div aria-hidden="true" className="geo-bg">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
          <circle cx="12%" cy="10%" r="2" fill="var(--theme-accent)" opacity="0.35" />
          <circle cx="26%" cy="22%" r="2.5" fill="var(--theme-accent)" opacity="0.6" />
          <circle cx="42%" cy="9%" r="1.5" fill="var(--theme-accent)" opacity="0.3" />
          <circle cx="65%" cy="16%" r="2" fill="var(--theme-accent)" opacity="0.45" />
          <circle cx="84%" cy="7%" r="2" fill="var(--theme-accent)" opacity="0.4" />
          <circle cx="91%" cy="28%" r="3" fill="var(--theme-accent)" opacity="0.7" />
          <circle cx="8%" cy="52%" r="2" fill="var(--theme-accent)" opacity="0.3" />
          <circle cx="20%" cy="68%" r="1.5" fill="var(--theme-accent)" opacity="0.4" />
          <circle cx="76%" cy="54%" r="2.5" fill="var(--theme-accent)" opacity="0.5" />
          <circle cx="88%" cy="72%" r="2" fill="var(--theme-accent)" opacity="0.4" />
          <circle cx="32%" cy="86%" r="2.5" fill="var(--theme-accent)" opacity="0.55" />
          <circle cx="58%" cy="79%" r="1.5" fill="var(--theme-accent)" opacity="0.3" />
          <line x1="12%" y1="10%" x2="26%" y2="22%" stroke="var(--theme-svg-accent-3)" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="65%" y1="16%" x2="84%" y2="7%" stroke="var(--theme-svg-accent-3)" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="84%" y1="7%" x2="91%" y2="28%" stroke="var(--theme-svg-accent-3)" strokeWidth="0.8" strokeDasharray="3 3" />
        </svg>
      </div>
    );
  }

  // Default: geometric
  return (
    <div aria-hidden="true" className="geo-bg">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        {/* Rings — top right */}
        <circle cx="92%" cy="-60" r="440" fill="none" stroke="var(--theme-svg-accent-1)" strokeWidth="1.5" />
        <circle cx="92%" cy="-60" r="320" fill="none" stroke="var(--theme-svg-accent-2)" strokeWidth="1" />
        <circle cx="92%" cy="-60" r="200" fill="none" stroke="var(--theme-svg-accent-3)" strokeWidth="1" />
        {/* Rings — bottom left */}
        <circle cx="-4%" cy="88%" r="300" fill="none" stroke="var(--theme-svg-accent-1)" strokeWidth="1.5" />
        <circle cx="-4%" cy="88%" r="190" fill="none" stroke="var(--theme-svg-accent-2)" strokeWidth="1" />
        {/* Diagonal accent lines — top right */}
        <line x1="65%" y1="0%" x2="100%" y2="22%" stroke="var(--theme-svg-accent-2)" strokeWidth="1" />
        <line x1="75%" y1="0%" x2="100%" y2="14%" stroke="var(--theme-svg-accent-3)" strokeWidth="1" />
        <line x1="55%" y1="0%" x2="100%" y2="30%" stroke="var(--theme-svg-accent-3)" strokeWidth="1" />
        {/* Small decorative ring — center-left */}
        <circle cx="5%" cy="42%" r="80" fill="none" stroke="var(--theme-svg-accent-2)" strokeWidth="1" />
        <circle cx="5%" cy="42%" r="50" fill="none" stroke="var(--theme-svg-accent-3)" strokeWidth="1" />
      </svg>
    </div>
  );
}

export default function ClassHome({ classId }: Props) {
  const [settings, setSettings] = useState<ClassSettings>({
    className: "כיתה ח׳2",
    schoolName: "חטיבת הביניים בן גוריון הרצליה",
    theme: "kita2",
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "classes", classId, "meta", "settings"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ClassSettings;
          setSettings({
            className: data.className || "כיתה",
            schoolName: data.schoolName || "",
            theme: data.theme || "kita2",
            logoUrl: data.logoUrl || "",
            motto: data.motto || "",
            bgStyle: data.bgStyle || "geometric",
            mascot: data.mascot || "",
            coverUrl: data.coverUrl || "",
            defaultMode: data.defaultMode || "dark",
            fontStyle: data.fontStyle || "modern",
            modules: data.modules,
          });
        }
      },
      (err) => console.error("Error fetching class settings:", err)
    );

    return () => unsubscribe();
  }, [classId]);

  const currentTheme = settings.theme || "kita2";
  const fontClass =
    settings.fontStyle === "rounded"
      ? "font-rounded"
      : settings.fontStyle === "classic"
      ? "font-classic"
      : "font-modern";

  return (
    <div data-class-theme={currentTheme} className={`min-h-screen ${fontClass}`}>
      <ThemeInitializer classId={currentTheme} defaultMode={settings.defaultMode} />

      <AuthGate
        classId={classId}
        classNameTitle={settings.className}
        schoolNameTitle={settings.schoolName}
      >
        <ClassBackground bgStyle={settings.bgStyle} />

        <ClassNav
          classLabel={settings.className}
          mascot={settings.mascot}
          modules={settings.modules}
        />

        <main className="pt-20 max-w-3xl mx-auto px-4" style={{ position: "relative", zIndex: 1 }}>
          {/* Hero Cover Banner */}
          {settings.coverUrl && (
            <div className="relative w-full h-44 sm:h-64 rounded-3xl overflow-hidden mt-4 mb-2 border border-white/10 shadow-lg group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.coverUrl}
                alt="תמונת נושא כיתתית"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
          )}

          <div className="text-center py-14 flex flex-col items-center gap-4">
            {/* School Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.logoUrl || "/school-logo.png"}
              alt={settings.schoolName || "סמל בית הספר"}
              width={86}
              height={86}
              className="max-h-[86px] object-contain"
              style={{
                filter: settings.logoUrl ? "none" : "var(--logo-filter)",
              }}
            />
            <div className="flex items-center flex-col gap-1.5">
              {settings.schoolName && (
                <p className="text-sm text-muted-foreground tracking-widest uppercase" style={{ letterSpacing: "0.15em" }}>
                  {settings.schoolName}
                </p>
              )}
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground flex items-center justify-center gap-3 flex-wrap">
                {settings.mascot && (
                  <span className="text-3xl sm:text-4xl select-none" aria-hidden="true">
                    {settings.mascot}
                  </span>
                )}
                <span>{settings.className}</span>
              </h1>
              {settings.motto && (
                <p className="text-base sm:text-lg text-foreground/85 font-medium italic mt-2 max-w-lg text-center leading-relaxed">
                  {settings.motto}
                </p>
              )}
            </div>
          </div>

          {/* Announcements */}
          {settings.modules?.announcements !== false && (
            <section id="announcements" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-6">הודעות המחנך</h2>
              <Announcements classId={classId} />
            </section>
          )}

          <EmergencySchedule classId={classId} />

          {/* Schedule */}
          {settings.modules?.schedule !== false && (
            <section id="schedule" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-6">מערכת שעות</h2>
              <Schedule
                classId={classId}
                classNameTitle={settings.className}
                schoolNameTitle={settings.schoolName}
              />
            </section>
          )}

          {/* Events */}
          {settings.modules?.events !== false && (
            <section id="events" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-6">אירועים ומבחנים</h2>
              <Events classId={classId} />
            </section>
          )}

          {/* Seating */}
          {settings.modules?.seating !== false && (
            <section id="seating" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-6">מקומות ישיבה</h2>
              <Seating classId={classId} />
            </section>
          )}

          {/* Teachers */}
          {settings.modules?.teachers !== false && (
            <section id="teachers" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-1.5">צוות המורים</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                כאשר מפורסם מספר הטלפון של מורה יש להקפיד על פנייה בשעות ראויות ולא יאוחר מהשעה 20:00
              </p>
              <Teachers classId={classId} />
            </section>
          )}

          {/* Gallery */}
          {settings.modules?.gallery !== false && (
            <Gallery classId={classId} />
          )}

          {/* Quick Links */}
          {settings.modules?.links !== false && (
            <section id="links" className="py-16 border-t border-white/10">
              <h2 className="text-2xl font-bold text-foreground mb-6">קישורים חשובים</h2>
              <QuickLinks />
            </section>
          )}
        </main>
      </AuthGate>
    </div>
  );
}
