"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile, User } from "firebase/auth";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { generateClassSlug, checkClassSlugAvailable, isValidClassSlug } from "@/lib/slugUtils";
import { Sparkles, CheckCircle, Copy, Check, ArrowRight, ArrowLeft, ExternalLink, ShieldCheck, Share2 } from "lucide-react";
import ThemeInitializer from "@/components/class/ThemeInitializer";

const THEMES = [
  { id: "kita1", label: "כחול שמיים", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  { id: "kita2", label: "סגול מלכותי", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.4)" },
  { id: "kita3", label: "ירוק אמרלד", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  { id: "kita4", label: "כתום שקיעה", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  { id: "kita5", label: "ורוד מודרני", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.4)" },
];

export default function CreateClassWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Step 1: Teacher Account
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Class Details
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ checking: boolean; available: boolean; message?: string }>({
    checking: false,
    available: false,
  });

  // Step 3: Theme
  const [selectedTheme, setSelectedTheme] = useState("kita2");

  // General state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [hostname, setHostname] = useState("shichva.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostname(window.location.host);
    }
  }, []);

  // Monitor auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u) {
        if (u.displayName && !fullName) setFullName(u.displayName);
        if (u.email && !email) setEmail(u.email);
      }
    });
    return () => unsub();
  }, [fullName, email]);

  // Auto-generate slug when school or class changes (unless user edited slug manually)
  useEffect(() => {
    if (!slugManual && (schoolName || className)) {
      const generated = generateClassSlug(schoolName, className);
      setSlug(generated);
    }
  }, [schoolName, className, slugManual]);

  // Validate slug availability whenever slug changes
  useEffect(() => {
    if (!slug.trim()) {
      setSlugStatus({ checking: false, available: false, message: "" });
      return;
    }

    let active = true;
    setSlugStatus({ checking: true, available: false });

    const timeout = setTimeout(async () => {
      const result = await checkClassSlugAvailable(slug.trim());
      if (active) {
        setSlugStatus({
          checking: false,
          available: result.available,
          message: result.reason,
        });
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [slug]);

  // Navigate to Step 2
  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!currentUser) {
      if (!fullName.trim()) {
        setErrorMessage("נא להזין שם מלא");
        return;
      }
      if (!email.trim()) {
        setErrorMessage("נא להזין כתובת אימייל");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("הסיסמה חייבת להכיל לפחות 6 תווים");
        return;
      }
    }

    setStep(2);
  }

  // Navigate to Step 3
  function handleStep2Next(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!schoolName.trim()) {
      setErrorMessage("נא להזין את שם בית הספר");
      return;
    }
    if (!className.trim()) {
      setErrorMessage("נא להזין את שם הכיתה");
      return;
    }
    if (!slug.trim() || !isValidClassSlug(slug.trim())) {
      setErrorMessage("כתובת הקישור אינה תקינה. השתמש באותיות באנגלית, מספרים ומקפים בלבד");
      return;
    }
    if (!slugStatus.available) {
      setErrorMessage(slugStatus.message || "כתובת זו אינה פנויה, אנא בחר כתובת אחרת");
      return;
    }

    setStep(3);
  }

  // Submit and create class
  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    try {
      let activeUser = currentUser;

      // 1. Create auth user if not logged in
      if (!activeUser) {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        activeUser = userCred.user;
        await updateProfile(activeUser, { displayName: fullName.trim() });
      }

      const finalSlug = slug.trim().toLowerCase();

      // 2. Create or update user profile
      await setDoc(
        doc(db, "users", activeUser.uid),
        {
          uid: activeUser.uid,
          email: activeUser.email || email.trim().toLowerCase(),
          fullName: fullName.trim() || activeUser.displayName || "מורה",
          role: "admin",
          status: "approved",
          schoolName: schoolName.trim(),
          adminClasses: arrayUnion(finalSlug),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 3. Create root class doc
      await setDoc(doc(db, "classes", finalSlug), {
        id: finalSlug,
        className: className.trim(),
        schoolName: schoolName.trim(),
        theme: selectedTheme,
        ownerUid: activeUser.uid,
        createdAt: new Date().toISOString(),
      });

      // 4. Create class settings doc
      await setDoc(doc(db, "classes", finalSlug, "meta", "settings"), {
        className: className.trim(),
        schoolName: schoolName.trim(),
        theme: selectedTheme,
        notifyOnRegistration: true,
        notificationEmail: activeUser.email || email.trim().toLowerCase(),
        ownerUid: activeUser.uid,
        createdAt: new Date().toISOString(),
      });

      // 5. Initialize whitelist with the teacher
      await setDoc(doc(db, "classes", finalSlug, "meta", "whitelist"), {
        emails: [activeUser.email?.toLowerCase() || email.trim().toLowerCase()],
      });

      // 6. Advance to success screen
      setStep(4);
    } catch (err: unknown) {
      console.error("Error creating class:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setErrorMessage("כתובת אימייל זו כבר רשומה במערכת. אנא התחבר במקום.");
      } else {
        const msg = err instanceof Error ? err.message : "אירעה שגיאה ביצירת הכיתה";
        setErrorMessage(`שגיאה: ${msg}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${slug}`
    : `https://${hostname}/${slug}`;

  const adminUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${slug}/admin`
    : `https://${hostname}/${slug}/admin`;

  function copyPublicLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const whatsappMessage = encodeURIComponent(
    `שלום לכולם! 🌟\nשמחים להשיק את אתר ${className} (${schoolName}).\nבאתר תמצאו את מערכת השעות, לוח המבחנים והאירועים, הודעות, ועוד:\n${publicUrl}\nהכניסה בהרשמה חד-פעמית.`
  );

  return (
    <div data-class-theme={selectedTheme} className="min-h-screen flex flex-col items-center justify-center p-4">
      <ThemeInitializer classId={selectedTheme} />

      {/* Decorative background */}
      <div aria-hidden="true" className="geo-bg">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
          <circle cx="90%" cy="-40" r="380" fill="none" stroke="var(--theme-svg-accent-1)" strokeWidth="1.5" />
          <circle cx="90%" cy="-40" r="240" fill="none" stroke="var(--theme-svg-accent-2)" strokeWidth="1" />
          <circle cx="-5%" cy="90%" r="300" fill="none" stroke="var(--theme-svg-accent-1)" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>פתיחת אתר כיתה חדש תוך דקה</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            הקמת אתר כיתה
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            מערכת שעות, לוח אירועים ומבחנים, הודעות, מקומות ישיבה וגלריה — מוגן ומותאם בדיוק לכיתה שלך.
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              step === 1 ? "bg-violet-600 text-white" : "bg-white/5 text-muted-foreground"
            }`}>
              <span>1</span>
              <span>פרטי מורה</span>
            </div>
            <span className="text-white/20">──</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              step === 2 ? "bg-violet-600 text-white" : "bg-white/5 text-muted-foreground"
            }`}>
              <span>2</span>
              <span>פרטי כיתה</span>
            </div>
            <span className="text-white/20">──</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              step === 3 ? "bg-violet-600 text-white" : "bg-white/5 text-muted-foreground"
            }`}>
              <span>3</span>
              <span>עיצוב</span>
            </div>
          </div>
        )}

        {/* Wizard Card */}
        <div
          className="rounded-3xl p-6 sm:p-8 transition-all duration-300"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          }}
        >
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center font-medium">
              {errorMessage}
            </div>
          )}

          {/* ── STEP 1: Teacher Account ── */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">שלב 1: פתיחת חשבון מנהל/ת</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  פרטים אלו ישמשו אותך לכניסה לפאנל הניהול של האתר.
                </p>
              </div>

              {currentUser ? (
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-violet-400" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        מחובר כעת: {currentUser.displayName || currentUser.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-violet-300 font-bold bg-violet-500/20 px-2.5 py-1 rounded-full">
                    מחובר
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">שם מלא (המחנך/ת)</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="לדוגמה: יעל כהן"
                      required
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">כתובת אימייל</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@school.org.il"
                      required
                      dir="ltr"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">סיסמה לפאנל הניהול</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="לפחות 6 תווים"
                      required
                      minLength={6}
                      dir="ltr"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="mt-4 w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:opacity-95"
                style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
              >
                <span>המשך לשלב הבא</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <p className="text-center text-xs text-muted-foreground">
                כבר יש לך חשבון?{" "}
                <Link href="/admin" className="text-violet-400 hover:underline">
                  כניסה לפאנל ניהול
                </Link>
              </p>
            </form>
          )}

          {/* ── STEP 2: Class Details ── */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">שלב 2: הגדרת הכיתה והקישור</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  הזן את שם בית הספר והכיתה. הקישור הייחודי ייבנה אוטומטית.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">שם בית הספר</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="לדוגמה: חטיבת אלון, רעננה"
                  required
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">שם הכיתה</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="לדוגמה: כיתה ט׳3"
                  required
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">כתובת הקישור הייחודית של האתר</label>
                  {slugStatus.checking ? (
                    <span className="text-[11px] text-muted-foreground">בודק זמינות...</span>
                  ) : slugStatus.available ? (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> הכתובת פנויה
                    </span>
                  ) : slug.trim() ? (
                    <span className="text-[11px] text-amber-400 font-semibold">
                      {slugStatus.message || "לא זמין"}
                    </span>
                  ) : null}
                </div>

                <div
                  className="flex items-center rounded-xl px-3.5 py-2.5 text-sm transition-all"
                  dir="ltr"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${
                      slugStatus.available
                        ? "rgba(16, 185, 129, 0.5)"
                        : slugStatus.message
                        ? "rgba(245, 158, 11, 0.5)"
                        : "rgba(255,255,255,0.12)"
                    }`,
                  }}
                >
                  <span className="text-muted-foreground select-none font-mono">
                    {hostname}/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugManual(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    placeholder="alon-9c"
                    required
                    className="flex-1 bg-transparent text-foreground outline-none font-mono text-sm ml-1"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  קישור זה ישמש את ההורים והתלמידים כדי לגשת לאתר הכיתה.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>חזרה</span>
                </button>
                <button
                  type="submit"
                  disabled={!slugStatus.available || slugStatus.checking}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
                >
                  <span>המשך לבחירת עיצוב</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Theme Selection ── */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">שלב 3: בחירת ערכת נושא וצבע</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  בחר את הצבע הראשי של אתר הכיתה (ניתן לשנות בכל עת מהגדרות פאנל הניהול).
                </p>
              </div>

              {/* Theme Palette */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-right ${
                      selectedTheme === theme.id
                        ? "border-white/50 ring-2 ring-white/20"
                        : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                    style={{
                      background: selectedTheme === theme.id ? theme.bg : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full shadow-inner flex items-center justify-center"
                        style={{ background: theme.color }}
                      >
                        {selectedTheme === theme.id && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{theme.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Live Preview Preview Card */}
              <div
                className="p-5 rounded-2xl border transition-all"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <span className="text-xs font-bold text-muted-foreground">תצוגה מקדימה</span>
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                    style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
                  >
                    פעיל
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{schoolName || "שם בית הספר"}</p>
                <h3 className="text-lg font-bold text-foreground mt-0.5">{className || "שם הכיתה"}</h3>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground font-mono" dir="ltr">
                  <span>{hostname}/</span>
                  <span className="text-foreground font-bold">{slug}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 px-5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>חזרה</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>יוצר את אתר הכיתה...</span>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>הקם אתר כיתה עכשיו</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 4: Success & Launch ── */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center py-4 gap-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-foreground">מזל טוב! אתר הכיתה שלך מוכן 🎉</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  האתר של <strong className="text-foreground">{className}</strong> ({schoolName}) הוקם בהצלחה ומוכן לשימוש.
                </p>
              </div>

              {/* Shareable Link Box */}
              <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
                <span className="text-xs text-muted-foreground text-right font-medium">כתובת האתר לשיתוף עם ההורים:</span>
                <div className="flex items-center justify-between gap-2 bg-black/30 rounded-xl px-3.5 py-2.5" dir="ltr">
                  <span className="text-sm font-mono font-medium text-foreground truncate select-all">
                    {publicUrl}
                  </span>
                  <button
                    onClick={copyPublicLink}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-foreground transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                    title="העתק קישור"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">הועתק!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>העתק</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-3">
                <Link
                  href={adminUrl}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:opacity-95"
                  style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
                >
                  <span>כניסה לפאנל הניהול של הכיתה</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>

                <a
                  href={`https://wa.me/?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>שיתוף הודעה והזמנה בוואטסאפ</span>
                </a>

                <Link
                  href={publicUrl}
                  target="_blank"
                  className="py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <span>צפייה באתר כיתה לדוגמה</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
