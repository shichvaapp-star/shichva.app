"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import LoginForm from "@/components/admin/LoginForm";
import AdminAnnouncements from "@/components/admin/tabs/AdminAnnouncements";
import AdminEvents from "@/components/admin/tabs/AdminEvents";
import AdminTeachers from "@/components/admin/tabs/AdminTeachers";
import AdminSchedule from "@/components/admin/tabs/AdminSchedule";
import AdminSeating from "@/components/admin/tabs/AdminSeating";
import AdminEmergencySchedule from "@/components/admin/tabs/AdminEmergencySchedule";
import AdminGallery from "@/components/admin/tabs/AdminGallery";
import AdminLinks from "@/components/admin/tabs/AdminLinks";
import AdminUsers from "@/components/admin/tabs/AdminUsers";
import AdminSettings, { ClassSettings } from "@/components/admin/tabs/AdminSettings";
import ThemeInitializer from "@/components/class/ThemeInitializer";
import { collection, query, where, onSnapshot as onSnapshotFirestore } from "firebase/firestore";
import { UserProfile } from "@/types/user";

const TABS = [
  { id: "announcements", label: "הודעות" },
  { id: "events",        label: "אירועים" },
  { id: "teachers",      label: "מורים" },
  { id: "schedule",      label: "מערכת שעות" },
  { id: "seating",       label: "מקומות ישיבה" },
  { id: "emergency",     label: "חירום" },
  { id: "gallery",       label: "גלריה" },
  { id: "links",         label: "🔗 קישורים" },
  { id: "users",         label: "👥 משתמשים" },
  { id: "settings",      label: "⚙️ הגדרות" },
];

interface Props {
  classId: string;
}

export default function AdminDashboard({ classId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("announcements");
  const [pendingCount, setPendingCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [settings, setSettings] = useState<ClassSettings>({
    className: "כיתה ח׳2",
    theme: "kita2",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    const unsubscribeSettings = onSnapshot(
      doc(db, "classes", classId, "meta", "settings"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ClassSettings;
          setSettings({
            className: data.className || "כיתה",
            theme: data.theme || "kita2",
            schoolName: data.schoolName || "",
          });
        }
      },
      (err) => console.error("Settings snapshot error:", err)
    );

    const qPending = query(collection(db, "users"), where("status", "==", "pending"));
    const unsubscribePending = onSnapshotFirestore(
      qPending,
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const u = d.data() as UserProfile;
          const belongsToClass =
            (u.classes && u.classes.includes(classId)) ||
            u.classId === classId ||
            (u.adminClasses && u.adminClasses.includes(classId)) ||
            (classId === "kita2" && (!u.classes || u.classes.length === 0) && !u.classId && (!u.adminClasses || u.adminClasses.length === 0));
          if (belongsToClass) {
            count++;
          }
        });
        setPendingCount(count);
      },
      (err) => console.warn("Pending users snapshot warning:", err)
    );

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      unsubscribePending();
    };
  }, [classId]);

  if (authLoading) return null;

  const currentTheme = settings.theme || "kita2";
  const defaultClassId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2";
  const siteUrl = classId === defaultClassId ? "/" : `/${classId}`;

  return (
    <>
      <ThemeInitializer classId={currentTheme} />
      {!user ? (
        <LoginForm classId={classId} />
      ) : (
        <div data-class-theme={currentTheme} className="min-h-screen">
          {/* Top bar */}
          <div
            className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
            style={{
              background: "var(--nav-bg)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid var(--nav-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-foreground">{settings.className}</span>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-muted-foreground text-sm">פאנל ניהול</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={siteUrl}
                target="_blank"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                צפייה באתר ↗
              </Link>

              {/* Theme toggle button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer flex items-center justify-center"
                title={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
                aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 hover:rotate-45">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 hover:-rotate-12">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                  </svg>
                )}
              </button>

              <span className="text-foreground/20 text-xs">|</span>

              <button
                onClick={() => signOut(auth)}
                className="text-xs text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                יציאה
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div
            className="flex gap-2 px-6 py-3 overflow-x-auto border-b border-border bg-[var(--card-bg)]"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-sm px-4 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/40 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === "users" && pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-black font-bold text-[10px] rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-w-4xl mx-auto px-4 py-8">
            {activeTab === "announcements" && <AdminAnnouncements classId={classId} />}
            {activeTab === "events" && <AdminEvents classId={classId} />}
            {activeTab === "teachers" && <AdminTeachers classId={classId} />}
            {activeTab === "schedule" && <AdminSchedule classId={classId} />}
            {activeTab === "seating" && <AdminSeating classId={classId} />}
            {activeTab === "emergency" && <AdminEmergencySchedule classId={classId} />}
            {activeTab === "gallery" && <AdminGallery classId={classId} />}
            {activeTab === "links" && <AdminLinks classId={classId} />}
            {activeTab === "users" && <AdminUsers classId={classId} />}
            {activeTab === "settings" && <AdminSettings classId={classId} />}
          </div>
        </div>
      )}
    </>
  );
}
