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

export default function HomePage() {
  const classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2";

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
            className: data.className || "כיתה ח׳2",
            schoolName: data.schoolName || "חטיבת הביניים בן גוריון הרצליה",
            theme: data.theme || "kita2",
          });
        }
      },
      (err) => console.error("Error fetching class settings:", err)
    );

    return () => unsubscribe();
  }, [classId]);

  const currentTheme = settings.theme || "kita2";

  return (
    <div data-class-theme={currentTheme} className="min-h-screen">
      <ThemeInitializer classId={currentTheme} />

      <AuthGate
        classId={classId}
        classNameTitle={settings.className}
        schoolNameTitle={settings.schoolName}
      >
        {/* Geometric background */}
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

        <ClassNav classLabel={settings.className} />

        <main className="pt-20 max-w-3xl mx-auto px-4" style={{ position: "relative", zIndex: 1 }}>
          <div className="text-center py-16 flex flex-col items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/school-logo.png"
              alt={settings.schoolName || "סמל בית הספר"}
              width={86}
              height={86}
              style={{ filter: "var(--logo-filter)", objectFit: "contain" }}
            />
            <div className="flex items-center flex-col gap-1">
              {settings.schoolName && (
                <p className="text-sm text-muted-foreground tracking-widest uppercase" style={{ letterSpacing: "0.15em" }}>
                  {settings.schoolName}
                </p>
              )}
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">{settings.className}</h1>
            </div>
          </div>

          <section id="announcements" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-6">הודעות המחנך</h2>
            <Announcements classId={classId} />
          </section>

          <EmergencySchedule classId={classId} />

          <section id="schedule" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-6">מערכת שעות</h2>
            <Schedule
              classId={classId}
              classNameTitle={settings.className}
              schoolNameTitle={settings.schoolName}
            />
          </section>

          <section id="events" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-6">אירועים ומבחנים</h2>
            <Events classId={classId} />
          </section>

          <section id="seating" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-6">מקומות ישיבה</h2>
            <Seating classId={classId} />
          </section>

          <section id="teachers" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-1.5">צוות המורים</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              כאשר מפורסם מספר הטלפון של מורה יש להקפיד על פנייה בשעות ראויות ולא יאוחר מהשעה 20:00
            </p>
            <Teachers classId={classId} />
          </section>

          <Gallery classId={classId} />

          <section id="links" className="py-16 border-t border-white/10">
            <h2 className="text-2xl font-bold text-foreground mb-6">קישורים חשובים</h2>
            <QuickLinks />
          </section>
        </main>
      </AuthGate>
    </div>
  );
}
