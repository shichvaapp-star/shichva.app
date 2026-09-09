"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile, UserRole } from "@/types/user";

interface AuthModalProps {
  classId?: string;
  classNameTitle?: string;
  schoolNameTitle?: string;
}

export default function AuthModal({
  classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2",
  classNameTitle = "כיתה ח׳2",
  schoolNameTitle = "חטיבת הביניים בן גוריון הרצליה",
}: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError("אימייל או סיסמה שגויים. אנא נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("נא להזין שם מלא");
      return;
    }
    if (role === "parent" && !studentName.trim()) {
      setError("נא להזין את שם התלמיד/ה");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Check if email is in whitelist for automatic instant approval
      let isWhitelisted = false;
      try {
        const whitelistDocRef = doc(db, "classes", classId, "meta", "whitelist");
        const whitelistSnap = await getDoc(whitelistDocRef);
        if (whitelistSnap.exists()) {
          const list = (whitelistSnap.data()?.emails || []) as string[];
          if (list.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
            isWhitelisted = true;
          }
        }
      } catch (checkErr) {
        console.warn("Whitelist check skipped:", checkErr);
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const user = userCredential.user;

      // Update Firebase Auth profile displayName
      await updateProfile(user, { displayName: fullName.trim() });

      // Create Firestore User Document
      const newProfile: UserProfile = {
        uid: user.uid,
        email: normalizedEmail,
        fullName: fullName.trim(),
        role,
        ...(role === "parent" ? { studentName: studentName.trim() } : {}),
        status: isWhitelisted ? "approved" : "pending",
        createdAt: new Date().toISOString(),
        ...(isWhitelisted
          ? { approvedAt: new Date().toISOString(), approvedBy: "whitelist_auto" }
          : {}),
      };

      await setDoc(doc(db, "users", user.uid), newProfile);

      // Send email notification to teacher/admin if pending approval
      if (!isWhitelisted) {
        try {
          await fetch("/api/notify-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              classId,
              fullName: fullName.trim(),
              email: normalizedEmail,
              role,
              studentName: role === "parent" ? studentName.trim() : undefined,
            }),
          });
        } catch (notifyErr) {
          console.error("Failed to trigger registration notification email:", notifyErr);
        }
      }
    } catch (err: unknown) {
      console.error("Registration error:", err);
      const msg = (err as { code?: string })?.code;
      if (msg === "auth/email-already-in-use") {
        setError("כתובת האימייל כבר קיימת במערכת. נסו להתחבר במקום.");
      } else if (msg === "auth/invalid-email") {
        setError("כתובת אימייל לא תקינה.");
      } else if (msg === "auth/weak-password") {
        setError("הסיסמה חלשה מדי. השתמשו ב-6 תווים לפחות.");
      } else {
        setError("שגיאה בהרשמה. אנא נסו שוב מאוחר יותר.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          backdropFilter: "blur(14px)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/20 text-violet-300 border border-violet-500/30 mb-3 text-xl">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{classNameTitle}</h1>
          <p className="text-muted-foreground text-xs">{schoolNameTitle}</p>
          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300">
            אתר סגור ומוגן — שמירה על פרטיות התלמידים
          </div>
        </div>

        {/* Tab switch */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              !isRegister
                ? "bg-violet-600/30 text-violet-200 border border-violet-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            כניסה לחשבון
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError("");
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              isRegister
                ? "bg-violet-600/30 text-violet-200 border border-violet-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            הרשמה ראשונית
          </button>
        </div>

        {/* Login Form */}
        {!isRegister ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                dir="ltr"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
            >
              {loading ? "מתחבר..." : "כניסה לאתר"}
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">שם מלא</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="למשל: דניאל ישראלי"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">אני...</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`py-2 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    role === "student"
                      ? "bg-violet-600/40 text-violet-200 border border-violet-500/50"
                      : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
                  }`}
                >
                  🎓 תלמיד/ה בכיתה
                </button>
                <button
                  type="button"
                  onClick={() => setRole("parent")}
                  className={`py-2 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    role === "parent"
                      ? "bg-violet-600/40 text-violet-200 border border-violet-500/50"
                      : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
                  }`}
                >
                  👨‍👩‍👧 הורה
                </button>
              </div>
            </div>

            {role === "parent" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">שם התלמיד/ה</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="שם הבן/הבת בכיתה"
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">סיסמה (לפחות 6 תווים)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                dir="ltr"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
            >
              {loading ? "רושם חשבון..." : "שליחת בקשת הרשמה"}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              לאחר ההרשמה, מחנך/ת הכיתה יאשרו את הגישה לאתר.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
