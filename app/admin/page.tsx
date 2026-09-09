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
import AdminUsers from "@/components/admin/tabs/AdminUsers";
import AdminSettings, { ClassSettings } from "@/components/admin/tabs/AdminSettings";
import ThemeInitializer from "@/components/class/ThemeInitializer";
import { collection, query, where, onSnapshot as onSnapshotFirestore } from "firebase/firestore";

const TABS = [
  { id: "announcements", label: "הודעות" },
  { id: "events",        label: "אירועים" },
  { id: "teachers",      label: "מורים" },
  { id: "schedule",      label: "מערכת שעות" },
  { id: "seating",       label: "מקומות ישיבה" },
  { id: "emergency",     label: "חירום" },
  { id: "gallery",       label: "גלריה" },
  { id: "users",         label: "👥 משתמשים" },
  { id: "settings",      label: "⚙️ הגדרות" },
];

export default function AdminPage() {
  const classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2";

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("announcements");
  const [pendingCount, setPendingCount] = useState(0);
  const [settings, setSettings] = useState<ClassSettings>({
    className: "כיתה ח׳2",
    theme: "kita2",
  });

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
            className: data.className || "כיתה ח׳2",
            theme: data.theme || "kita2",
            schoolName: data.schoolName || "חטיבת הביניים בן גוריון הרצליה",
          });
        }
      },
      (err) => console.error("Settings snapshot error:", err)
    );

    const qPending = query(collection(db, "users"), where("status", "==", "pending"));
    const unsubscribePending = onSnapshotFirestore(
      qPending,
      (snap) => {
        setPendingCount(snap.size);
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

  return (
    <>
      <ThemeInitializer classId={currentTheme} />
      {!user ? (
        <LoginForm />
      ) : (
        <div data-class-theme={currentTheme} className="min-h-screen">
          {/* Top bar */}
          <div
            className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
            style={{
              background: "rgba(10,8,30,0.92)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-foreground">{settings.className}</span>
              <span className="text-white/20">|</span>
              <span className="text-muted-foreground text-sm">פאנל ניהול</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                target="_blank"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-white/10"
              >
                צפייה באתר ↗
              </Link>
              <button
                onClick={() => signOut(auth)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-white/10"
              >
                יציאה
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div
            className="flex gap-2 px-6 py-3 overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-sm px-4 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
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
            {activeTab === "users" && <AdminUsers classId={classId} />}
            {activeTab === "settings" && <AdminSettings classId={classId} />}
          </div>
        </div>
      )}
    </>
  );
}
