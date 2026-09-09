"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

interface Props {
  classId?: string;
}

export default function LoginForm({ classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2" }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("אימייל או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-class-theme={classId} className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-1 text-center">כניסת מורה / מנהל</h1>
        <p className="text-muted-foreground text-sm text-center mb-8">פאנל ניהול האתר</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted-foreground">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground outline-none transition-all bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted-foreground">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground outline-none transition-all bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
              dir="ltr"
            />
          </div>

          {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
          >
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border text-center flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">רוצה לפתוח אתר לכיתה שלך?</p>
          <Link
            href="/create"
            className="text-xs text-violet-700 dark:text-violet-300 hover:text-violet-800 dark:hover:text-violet-200 font-bold transition-colors inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30"
          >
            <span>פתיחת אתר כיתה חדש תוך דקה 🪄</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
