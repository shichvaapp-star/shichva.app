"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Printer } from "lucide-react";

interface ScheduleRow {
  id: string;
  order: number;
  period: string;
  time: string;
  type: string;
  sun: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
}

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri";

const DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri"];
const DAY_LABELS: Record<DayKey, string> = {
  sun: "ראשון",
  mon: "שני",
  tue: "שלישי",
  wed: "רביעי",
  thu: "חמישי",
  fri: "שישי",
};

function getTodayDayKey(): DayKey {
  const day = new Date().getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  if (day >= 0 && day <= 4) return DAYS[day];
  if (day === 5) return "fri";
  return "sun"; // On Saturday, show Sunday's schedule
}

interface ScheduleProps {
  classId: string;
  classNameTitle?: string;
  schoolNameTitle?: string;
}

export default function Schedule({ classId, classNameTitle, schoolNameTitle }: ScheduleProps) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayKey>(getTodayDayKey);
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "schedule"),
      orderBy("order")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScheduleRow)));
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [classId]);

  useEffect(() => {
    const handleBeforePrint = () => {
      if (!document.body.classList.contains("print-seating-mode")) {
        document.body.classList.add("print-schedule-mode");
      }
    };
    const handleAfterPrint = () => {
      document.body.classList.remove("print-schedule-mode");
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add("print-schedule-mode");
    setTimeout(() => {
      window.print();
    }, 50);
    const cleanup = () => {
      document.body.classList.remove("print-schedule-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 2000);
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-5">טוען מערכת שעות...</p>;
  }

  if (error) {
    return <p className="text-red-400 text-center py-5">שגיאה בטעינת המערכת</p>;
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-center py-5">אין נתונים</p>;
  }

  const todayKey = getTodayDayKey();

  return (
    <div id="schedule-print-area" className="flex flex-col gap-3.5">
      {/* ── Screen Controls & Mode Switcher ── */}
      <div className="schedule-screen-controls flex items-center justify-between gap-2">
        <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("daily")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === "daily"
                ? "bg-[rgba(var(--theme-accent-rgb),0.15)] border border-[rgba(var(--theme-accent-rgb),0.4)] text-[var(--theme-accent)] shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📅 תצוגה יומית
          </button>
          <button
            type="button"
            onClick={() => setViewMode("weekly")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === "weekly"
                ? "bg-[rgba(var(--theme-accent-rgb),0.15)] border border-[rgba(var(--theme-accent-rgb),0.4)] text-[var(--theme-accent)] shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 טבלה שבועית
          </button>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="schedule-print-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground active:scale-95"
          title="הדפסת מערכת שעות"
          aria-label="הדפסת מערכת שעות"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>הדפסה</span>
        </button>
      </div>

      {/* ── Screen View (Daily or Weekly) ── */}
      <div className="schedule-screen-view">
        {viewMode === "daily" ? (
          <div className="flex flex-col gap-3">
            {/* Day Tabs */}
            <div className="grid grid-cols-6 gap-1 sm:gap-2 p-1 bg-white/[0.03] border border-[var(--card-border)] rounded-xl">
              {DAYS.map((day) => {
                const isSelected = selectedDay === day;
                const isToday = todayKey === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer relative ${
                      isSelected
                        ? "bg-[rgba(var(--theme-accent-rgb),0.18)] border border-[rgba(var(--theme-accent-rgb),0.45)] text-[var(--theme-accent)] font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{DAY_LABELS[day]}</span>
                    {isToday && (
                      <span className="text-[9px] px-1 rounded-full bg-[rgba(var(--theme-accent-rgb),0.2)] text-[var(--theme-accent)] mt-0.5 leading-tight">
                        היום
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day Lessons List */}
            <div className="flex flex-col gap-2">
              {rows.map((row) => {
                if (row.type === "הפסקה") {
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[rgba(var(--theme-accent-rgb),0.06)] border border-[rgba(var(--theme-accent-rgb),0.15)] text-xs text-foreground/85"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">☕</span>
                        <span className="font-semibold">{row.sun || "הפסקה"}</span>
                      </div>
                      <span className="text-muted-foreground text-[11px]" dir="ltr">
                        {row.time}
                      </span>
                    </div>
                  );
                }

                const subject = row[selectedDay]?.trim();
                const hasLesson = Boolean(subject && subject !== "—");

                return (
                  <div
                    key={row.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      hasLesson
                        ? "bg-[var(--card-bg)] border-[var(--card-border)] shadow-xs"
                        : "bg-white/[0.02] border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{
                          backgroundColor: "rgba(var(--theme-accent-rgb), 0.15)",
                          color: "var(--theme-accent)",
                          border: "1px solid rgba(var(--theme-accent-rgb), 0.3)",
                        }}
                      >
                        {row.period}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm font-bold leading-tight ${
                            hasLesson ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {subject || "חלון / אין שיעור"}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5" dir="ltr" style={{ textAlign: "right" }}>
                          {row.time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── WEEKLY TABLE VIEW ── */
          <div className="schedule-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 52 }}>
                    <span className="sm:hidden">שיעור</span>
                    <span className="hidden sm:inline">שיעור</span>
                  </th>
                  <th className="hidden sm:table-cell" style={{ minWidth: 80 }}>
                    שעות
                  </th>
                  {DAYS.map((d) => (
                    <th key={d}>{DAY_LABELS[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.type === "הפסקה") {
                    return (
                      <tr key={row.id} className="schedule-break">
                        <td className="sm:hidden text-[10px]" dir="ltr">
                          {row.time}
                        </td>
                        <td className="hidden sm:table-cell text-xs" dir="ltr">
                          {row.time}
                        </td>
                        <td colSpan={6}>{row.sun}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-bold text-sm" style={{ color: "var(--theme-accent)" }}>
                            {row.period}
                          </span>
                          <span className="text-[10px] text-muted-foreground block sm:hidden whitespace-nowrap leading-none mt-0.5" dir="ltr">
                            {row.time}
                          </span>
                        </div>
                      </td>
                      <td className="text-muted-foreground text-xs whitespace-nowrap hidden sm:table-cell" dir="ltr">
                        {row.time}
                      </td>
                      {DAYS.map((day) => (
                        <td key={day} className={!row[day] ? "text-muted-foreground/40" : "text-foreground"}>
                          {row[day] || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DEDICATED PRINT VIEW (Always full weekly landscape layout) ── */}
      <div className="schedule-print-view hidden" aria-hidden="true">
        <div className="schedule-print-header">
          <div className="schedule-print-title-wrap">
            {schoolNameTitle && <p className="schedule-print-school">{schoolNameTitle}</p>}
            <h1 className="schedule-print-title">
              מערכת שעות שבועית {classNameTitle ? `— ${classNameTitle}` : ""}
            </h1>
          </div>
        </div>

        <table className="schedule-print-table">
          <thead>
            <tr>
              <th className="th-period">שיעור</th>
              <th className="th-time">שעות</th>
              {DAYS.map((d) => (
                <th key={d} className="th-day">{DAY_LABELS[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === "הפסקה") {
                return (
                  <tr key={row.id} className="schedule-print-break">
                    <td className="td-period-break" />
                    <td className="td-time-break" dir="ltr">{row.time}</td>
                    <td colSpan={6} className="td-break-text">
                      ☕ {row.sun || "הפסקה"}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.id}>
                  <td className="td-period">
                    <span className="period-badge">{row.period}</span>
                  </td>
                  <td className="td-time" dir="ltr">
                    {row.time}
                  </td>
                  {DAYS.map((day) => {
                    const subject = row[day]?.trim();
                    return (
                      <td key={day} className={`td-lesson ${!subject ? "empty-lesson" : ""}`}>
                        {subject || "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

