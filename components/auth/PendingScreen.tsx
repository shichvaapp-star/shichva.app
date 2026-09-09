"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserProfile } from "@/types/user";

interface PendingScreenProps {
  profile: UserProfile;
}

export default function PendingScreen({ profile }: PendingScreenProps) {
  const isRejected = profile.status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex justify-center mb-5">
          {isRejected ? (
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-3xl">
              🚫
            </div>
          ) : (
            <div className="relative w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl">
              <span className="animate-pulse">⏳</span>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isRejected ? "הגישה לא אושרה" : "ממתין לאישור מורה"}
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {isRejected
            ? `שלום ${profile.fullName}, בקשת ההרשמה שלך לא אושרה. לבירורים ניתן לפנות למחנך/ת הכיתה.`
            : `שלום ${profile.fullName}! הרשמתך כ${profile.role === "parent" ? "הורה" : "תלמיד/ה"} נקלטה בהצלחה. לשמירה על פרטיות התלמידים, מחנך/ת הכיתה יאשרו את חשבונך בהקדם.`}
        </p>

        <div
          className="rounded-xl p-4 mb-6 text-right text-xs text-muted-foreground space-y-1.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex justify-between">
            <span className="text-foreground font-medium">{profile.fullName}</span>
            <span>שם רשום:</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground font-mono" dir="ltr">{profile.email}</span>
            <span>אימייל:</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground">
              {profile.role === "parent" ? `הורה (תלמיד/ה: ${profile.studentName || "—"})` : "תלמיד/ה"}
            </span>
            <span>תפקיד:</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-amber-400">
              {isRejected ? "נדחה" : "ממתין לאישור"}
            </span>
            <span>סטטוס:</span>
          </div>
        </div>

        {!isRejected && (
          <p className="text-xs text-muted-foreground/80 mb-6">
            הדף יתרענן וייפתח אוטומטית ברגע שהמורה יאשר/תאשר את החשבון.
          </p>
        )}

        <button
          onClick={() => signOut(auth)}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer hover:bg-white/5"
          style={{ border: "1px solid var(--card-border)" }}
        >
          התנתקות מהחשבון
        </button>
      </div>
    </div>
  );
}
