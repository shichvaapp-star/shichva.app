"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ThemeInitializer from "@/components/class/ThemeInitializer";

interface SurveyResponse {
  studentName: string;
  choice1: string;
  choice2: string;
  note: string;
  submittedAt: string | null;
  availablePartners: string[];
  className: string;
  schoolName: string;
  theme: string;
}

function SeatRequestContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("t") || "";
  const classId = searchParams.get("classId") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<SurveyResponse | null>(null);

  const [choice1, setChoice1] = useState("");
  const [choice2, setChoice2] = useState("");
  const [note, setNote] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("חסר קישור תקין. נא לפנות למורה לקבלת הקישור האישי שלך.");
      setLoading(false);
      return;
    }

    async function fetchSurvey() {
      try {
        setLoading(true);
        setError(null);
        const classQuery = classId ? `&classId=${encodeURIComponent(classId)}` : "";
        const res = await fetch(`/api/seating-request?token=${encodeURIComponent(token)}${classQuery}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "לא ניתן לטעון את הסקר כרגע");
          return;
        }

        setSurveyData(data);
        setChoice1(data.choice1 || "");
        setChoice2(data.choice2 || "");
        setNote(data.note || "");
      } catch (err: unknown) {
        console.error("Fetch error:", err);
        setError("שגיאה בתקשורת עם השרת");
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [token, classId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choice1) {
      alert("נא לבחור לפחות עדיפות ראשונה");
      return;
    }
    if (choice1 === choice2) {
      alert("עדיפות ראשונה ושנייה חייבות להיות תלמידים שונים");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/seating-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          classId: classId || undefined,
          choice1,
          choice2,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בשמירת הבחירות");
        return;
      }

      setSuccessMessage("הבחירות שלך נשמרו בהצלחה! תודה רבה 🎉");
      if (surveyData) {
        setSurveyData({
          ...surveyData,
          choice1,
          choice2,
          note,
          submittedAt: data.submittedAt || new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      console.error("Submit error:", err);
      setError("שגיאה בשליחת הטופס. אנא נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentTheme = surveyData?.theme || "kita2";

  return (
    <div data-class-theme={currentTheme} className="min-h-screen flex flex-col justify-between" dir="rtl">
      <ThemeInitializer classId={currentTheme} />

      {/* Header */}
      <header
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--card-border)",
        }}
      >
        <div>
          <h1 className="font-bold text-sm sm:text-base text-foreground">
            {surveyData?.className || "אתר הכיתה"}
          </h1>
          {surveyData?.schoolName && (
            <p className="text-[11px] text-muted-foreground">{surveyData.schoolName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-medium">
            סקר מקומות ישיבה 🪑
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {loading ? (
          <div className="rounded-2xl p-10 text-center flex flex-col items-center gap-3"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="w-9 h-9 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground">טוען את הסקר שלך...</p>
          </div>
        ) : error ? (
          <div
            className="rounded-2xl p-8 text-center space-y-4"
            style={{
              background: "var(--card-bg)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <div className="text-4xl">⚠️</div>
            <h2 className="text-base font-bold text-foreground">לא ניתן לפתוח את הסקר</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
          </div>
        ) : surveyData ? (
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-xl transition-all"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            {/* Header / Praise */}
            <div className="text-center mb-6 space-y-2">
              <div className="inline-block p-3 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-3xl mb-1">
                🌟
              </div>
              <h2 className="text-xl font-extrabold text-foreground">
                היי {surveyData.studentName}!
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                כל הכבוד על ההתנהגות הטובה והאחריות האישית שהפגנת בכיתה! קיבלת את הזכות לבחור ליד מי תרצה לשבת בסבב הישיבה הבא.
              </p>
            </div>

            {/* Notification if already submitted */}
            {surveyData.submittedAt && !successMessage && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <span>✓</span>
                <span>
                  כבר הגשת בחירות בעבר ({new Date(surveyData.submittedAt).toLocaleDateString("he-IL")}). ניתן לעדכן אותן בטופס למטה.
                </span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-sm font-semibold flex items-center gap-2">
                <span>🎉</span>
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Choice 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>🥇 עדיפות ראשונה</span>
                  <span className="text-[10px] text-violet-600 dark:text-violet-400 font-normal">חובה</span>
                </label>
                <select
                  value={choice1}
                  onChange={(e) => {
                    setChoice1(e.target.value);
                    setSuccessMessage(null);
                  }}
                  required
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs text-foreground bg-black/[0.04] dark:bg-white/[0.07] border border-black/15 dark:border-white/15 focus:border-violet-500 outline-none cursor-pointer transition-all"
                >
                  <option value="">-- בחר/י חבר/ה לכיתה --</option>
                  {surveyData.availablePartners.map((name) => (
                    <option key={name} value={name} disabled={name === choice2}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Choice 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>🥈 עדיפות שנייה</span>
                  <span className="text-[10px] text-muted-foreground font-normal">מומלץ</span>
                </label>
                <select
                  value={choice2}
                  onChange={(e) => {
                    setChoice2(e.target.value);
                    setSuccessMessage(null);
                  }}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs text-foreground bg-black/[0.04] dark:bg-white/[0.07] border border-black/15 dark:border-white/15 focus:border-violet-500 outline-none cursor-pointer transition-all"
                >
                  <option value="">-- בחר/י אפשרות שנייה (אופציונלי) --</option>
                  {surveyData.availablePartners.map((name) => (
                    <option key={name} value={name} disabled={name === choice1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note to teacher */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  הערה למורה (אופציונלי)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setSuccessMessage(null);
                  }}
                  placeholder="למשל: מעדיף/ה לשבת קרוב ללוח..."
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs text-foreground bg-black/[0.04] dark:bg-white/[0.07] border border-black/15 dark:border-white/15 focus:border-violet-500 outline-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !choice1}
                className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-violet-600/20 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>שומר בחירות...</span>
                  </>
                ) : (
                  <span>שליחת הבחירות למורה ✓</span>
                )}
              </button>

              <p className="text-[11px] text-center text-muted-foreground pt-1">
                המערכת תשתדל לסדר את המקומות בהתאם לבקשות. ההחלטה הסופית בידי מחנכ/ת הכיתה.
              </p>
            </form>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[11px] text-muted-foreground border-t border-black/5 dark:border-white/5">
        אתר הכיתה • סידור מקומות ישיבה
      </footer>
    </div>
  );
}

export default function SeatRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <SeatRequestContent />
    </Suspense>
  );
}
