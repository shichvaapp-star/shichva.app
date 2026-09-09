"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ProcessedEvent {
  id: string;
  date: Date;
  sortEnd: Date;
  display: string;
  title: string;
  time: string;
  cat: string;
}

interface MonthGroup {
  label: string;
  events: ProcessedEvent[];
  allPast: boolean;
}

const MONTH_NAMES = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

const CATEGORIES = [
  { cats: "מבחן",    label: "מבחן",      dot: "bg-red-500",     badge: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25" },
  { cats: "בוחן",    label: "בוחן",      dot: "bg-orange-500",  badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25" },
  { cats: "אירוע",   label: "אירוע",     dot: "bg-blue-500",    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25" },
  { cats: "חג,חופש", label: "חג / חופש", dot: "bg-violet-500",  badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25" },
  { cats: "טיול",    label: "טיול",      dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25" },
];

function getCatStyle(cat: string) {
  return (
    CATEGORIES.find((c) => c.cats.split(",").includes(cat)) ?? {
      dot: "bg-blue-500",
      badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25",
      label: cat,
    }
  );
}

function formatRange(start: Date, end?: Date): string {
  const d1 = start.getDate(), m1 = start.getMonth() + 1;
  if (!end || isNaN(end.getTime())) return `${d1}.${m1}`;
  const d2 = end.getDate(), m2 = end.getMonth() + 1;
  return m1 === m2 ? `${d1}–${d2}.${m1}` : `${d1}.${m1}–${d2}.${m2}`;
}

function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case "מבחן":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "בוחן":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
    case "חג":
    case "חופש":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30";
    case "טיול":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  }
}

export default function Events({ classId }: { classId: string }) {
  const [allEvents, setAllEvents] = useState<ProcessedEvent[]>([]);
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [showPast, setShowPast] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "all" | "calendar">("month");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Calendar view month state
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  });

  // Selected date popup modal in calendar view
  const [selectedCellDate, setSelectedCellDate] = useState<Date | null>(null);

  useEffect(() => {
    getDocs(collection(db, "classes", classId, "events"))
      .then((snapshot) => {
        if (snapshot.empty) {
          setAllEvents([]);
          setMonthGroups([]);
          setLoading(false);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events: ProcessedEvent[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const date = data.date?.toDate() ?? new Date(NaN);
            const endDate = data.endDate?.toDate() as Date | undefined;
            const sortEnd =
              endDate && !isNaN(endDate.getTime()) ? endDate : date;
            return {
              id: doc.id,
              date,
              sortEnd,
              display: formatRange(date, endDate),
              title: data.title || "",
              time: data.time || "",
              cat: data.category || "",
            };
          })
          .filter((e) => e.title && !isNaN(e.date.getTime()))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        setAllEvents(events);

        const groupMap: Record<string, { label: string; events: ProcessedEvent[] }> = {};
        const groupOrder: string[] = [];

        events.forEach((e) => {
          const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
          if (!groupMap[key]) {
            groupMap[key] = {
              label: `${MONTH_NAMES[e.date.getMonth()]} ${e.date.getFullYear()}`,
              events: [],
            };
            groupOrder.push(key);
          }
          groupMap[key].events.push(e);
        });

        const groups: MonthGroup[] = groupOrder.map((key) => ({
          label: groupMap[key].label,
          events: groupMap[key].events,
          allPast: groupMap[key].events.every((e) => e.sortEnd < today),
        }));

        const firstNonPast = groups.findIndex((g) => !g.allPast);
        setMonthGroups(groups);
        setMonthIdx(firstNonPast >= 0 ? firstNonPast : groups.length - 1);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [classId]);

  if (loading) return <p className="text-muted-foreground text-center py-5">טוען אירועים...</p>;
  if (error) return <p className="text-red-400 text-center py-5">שגיאה בטעינת האירועים</p>;
  if (monthGroups.length === 0) return <p className="text-muted-foreground text-center py-5">אין אירועים</p>;

  const group = monthGroups[monthIdx];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const displayPast = showPast || group?.allPast;
  const activeCats = activeFilter ? activeFilter.split(",") : null;

  const filterEvent = (e: ProcessedEvent) => {
    if (!displayPast && e.sortEnd < today) return false;
    if (activeCats && !activeCats.includes(e.cat)) return false;
    return true;
  };

  const visibleEventsForCurrentMonth = group ? group.events.filter(filterEvent) : [];

  // Filter all events grouped by month for "all" mode (hiding past events by default)
  const allFilteredGroups = monthGroups
    .map((g) => ({
      label: g.label,
      events: g.events.filter((e) => {
        if (!showPast && e.sortEnd < today) return false;
        if (activeCats && !activeCats.includes(e.cat)) return false;
        return true;
      }),
    }))
    .filter((g) => g.events.length > 0);

  const pastEventsCount = allEvents.filter(
    (e) => e.sortEnd < today && (!activeCats || activeCats.includes(e.cat))
  ).length;

  // Calendar cells generation (42 cells: 6 rows of 7 days)
  const todayStr = (() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const startDayOfWeek = calMonth.getUTCDay();
  const gridStartDate = new Date(
    Date.UTC(
      calMonth.getUTCFullYear(),
      calMonth.getUTCMonth(),
      1 - startDayOfWeek
    )
  );

  const calCells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    calCells.push(
      new Date(
        Date.UTC(
          gridStartDate.getUTCFullYear(),
          gridStartDate.getUTCMonth(),
          gridStartDate.getUTCDate() + i
        )
      )
    );
  }

  // Selected date events for modal
  const selectedDateEvents = selectedCellDate
    ? allEvents.filter((e) => {
        if (activeCats && !activeCats.includes(e.cat)) return false;
        const cellStr = selectedCellDate.toISOString().slice(0, 10);
        const startStr = e.date.toISOString().slice(0, 10);
        const endStr = e.sortEnd.toISOString().slice(0, 10);
        return startStr <= cellStr && cellStr <= endStr;
      })
    : [];

  return (
    <div>
      {/* Category legend / filter */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {CATEGORIES.map((c) => {
          const isActive = activeFilter === c.cats;
          const isDimmed = activeFilter !== null && activeFilter !== c.cats;
          return (
            <button
              key={c.cats}
              onClick={() => setActiveFilter(isActive ? null : c.cats)}
              className={`flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1 rounded-full border transition-all duration-150 cursor-pointer select-none ${
                isActive
                  ? "border-foreground/20 bg-foreground/10 text-foreground font-semibold shadow-xs"
                  : isDimmed
                  ? "border-transparent text-muted-foreground opacity-30"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* View Mode Switcher (Month vs All vs Calendar) */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex p-1 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === "month"
                ? "bg-[rgba(var(--theme-accent-rgb),0.15)] border border-[rgba(var(--theme-accent-rgb),0.4)] text-[var(--theme-accent)] shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📅 לפי חודש
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === "all"
                ? "bg-[rgba(var(--theme-accent-rgb),0.15)] border border-[rgba(var(--theme-accent-rgb),0.4)] text-[var(--theme-accent)] shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 הצג הכל
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === "calendar"
                ? "bg-[rgba(var(--theme-accent-rgb),0.15)] border border-[rgba(var(--theme-accent-rgb),0.4)] text-[var(--theme-accent)] shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🗓️ תצוגת לוח שנה
          </button>
        </div>
      </div>

      {/* ── BY-MONTH VIEW ── */}
      {viewMode === "month" && (
        <>
          {/* Month navigator — direction: ltr so ‹ is physically left (= forward) */}
          <div
            className="flex items-center justify-between max-w-xl mx-auto mb-4"
            style={{ direction: "ltr" }}
          >
            <button
              onClick={() => setMonthIdx((i) => i + 1)}
              disabled={monthIdx === monthGroups.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border/70 bg-black/5 dark:bg-white/[0.07] text-foreground text-xl hover:bg-black/10 dark:hover:bg-white/[0.14] transition-all disabled:opacity-20 disabled:cursor-default cursor-pointer"
            >
              ‹
            </button>
            <span className="font-bold text-foreground text-lg" style={{ direction: "rtl" }}>
              {group?.label}
            </span>
            <button
              onClick={() => setMonthIdx((i) => i - 1)}
              disabled={monthIdx === 0}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border/70 bg-black/5 dark:bg-white/[0.07] text-foreground text-xl hover:bg-black/10 dark:hover:bg-white/[0.14] transition-all disabled:opacity-20 disabled:cursor-default cursor-pointer"
            >
              ›
            </button>
          </div>

          {/* Current Month Events list */}
          {visibleEventsForCurrentMonth.length === 0 ? (
            <p className="text-muted-foreground text-center py-5">אין אירועים לחודש זה</p>
          ) : (
            <div className="space-y-1.5 max-w-xl mx-auto">
              {visibleEventsForCurrentMonth.map((e) => {
                const isPast = e.sortEnd < today;
                const style = getCatStyle(e.cat);
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors ${
                      isPast && displayPast ? "opacity-40" : ""
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                    <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap min-w-[60px]">
                      {e.display}
                    </span>
                    <span className="flex-1 text-foreground font-medium text-sm">{e.title}</span>
                    {e.time && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">{e.time}</span>
                    )}
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ALL EVENTS VIEW ── */}
      {viewMode === "all" && (
        <div className="max-w-xl mx-auto space-y-5">
          {pastEventsCount > 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowPast((p) => !p)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs border border-border/70 bg-black/5 dark:bg-white/[0.04] hover:bg-black/10 dark:hover:bg-white/[0.09] text-foreground transition-all cursor-pointer shadow-xs"
              >
                <span>{showPast ? "👁️ הסתר אירועים שעברו" : "🕒 הצג גם אירועים שעברו"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-foreground font-mono">
                  {pastEventsCount}
                </span>
              </button>
            </div>
          )}

          {allFilteredGroups.length === 0 ? (
            <p className="text-muted-foreground text-center py-5">
              {pastEventsCount > 0 && !showPast
                ? "אין אירועים עתידיים להצגה (לחץ על הכפתור למעלה לצפייה באירועים שעברו)"
                : "אין אירועים להצגה"}
            </p>
          ) : (
            allFilteredGroups.map((g) => (
              <div key={g.label} className="space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <span className="font-bold text-sm text-[var(--theme-accent)]">
                    {g.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({g.events.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {g.events.map((e) => {
                    const isPast = e.sortEnd < today;
                    const style = getCatStyle(e.cat);
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors ${
                          isPast ? "opacity-45" : ""
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                        <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap min-w-[60px]">
                          {e.display}
                        </span>
                        <span className="flex-1 text-foreground font-medium text-sm">{e.title}</span>
                        {e.time && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">{e.time}</span>
                        )}
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CALENDAR TABLE VIEW ── */}
      {viewMode === "calendar" && (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* Month Controls */}
          <div className="flex items-center justify-between" style={{ direction: "ltr" }}>
            <button
              onClick={() =>
                setCalMonth(
                  new Date(Date.UTC(calMonth.getUTCFullYear(), calMonth.getUTCMonth() + 1, 1))
                )
              }
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border/70 bg-black/5 dark:bg-white/[0.07] text-foreground text-xl hover:bg-black/10 dark:hover:bg-white/[0.14] transition-all cursor-pointer"
            >
              ‹
            </button>
            <span className="font-bold text-foreground text-lg" style={{ direction: "rtl" }}>
              {MONTH_NAMES[calMonth.getUTCMonth()]} {calMonth.getUTCFullYear()}
            </span>
            <button
              onClick={() =>
                setCalMonth(
                  new Date(Date.UTC(calMonth.getUTCFullYear(), calMonth.getUTCMonth() - 1, 1))
                )
              }
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border/70 bg-black/5 dark:bg-white/[0.07] text-foreground text-xl hover:bg-black/10 dark:hover:bg-white/[0.14] transition-all cursor-pointer"
            >
              ›
            </button>
          </div>

          {/* Grid Container */}
          <div className="w-full overflow-x-auto rounded-xl border border-border/60 bg-[var(--card-bg)] shadow-md">
            <div className="min-w-[580px] grid grid-cols-7 border-collapse">
              {/* Day Name Headers */}
              {["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].map((dayName) => (
                <div
                  key={dayName}
                  className="p-2 text-center text-xs font-semibold text-muted-foreground border-b border-border/60 bg-black/[0.02] dark:bg-white/[0.03]"
                >
                  {dayName}
                </div>
              ))}

              {/* Day Grid Cells */}
              {calCells.map((cellDate, idx) => {
                const cellStr = cellDate.toISOString().slice(0, 10);
                const isCurrentMonth = cellDate.getUTCMonth() === calMonth.getUTCMonth();
                const isToday = cellStr === todayStr;

                // Find events matching this day cell
                const cellEvents = allEvents.filter((item) => {
                  if (activeCats && !activeCats.includes(item.cat)) return false;
                  const startStr = item.date.toISOString().slice(0, 10);
                  const endStr = item.sortEnd.toISOString().slice(0, 10);
                  return startStr <= cellStr && cellStr <= endStr;
                });

                return (
                  <div
                    key={cellStr}
                    onClick={() => {
                      if (cellEvents.length > 0) {
                        setSelectedCellDate(cellDate);
                      }
                    }}
                    className={`min-h-[85px] sm:min-h-[95px] flex flex-col justify-between p-1.5 sm:p-2 border-b border-r border-border/60 hover:bg-black/5 dark:hover:bg-white/[0.04] transition-colors select-none ${
                      isCurrentMonth ? "" : "opacity-25"
                    } ${
                      idx % 7 === 0 ? "border-l border-border/60" : ""
                    } ${
                      cellEvents.length > 0 ? "cursor-pointer" : ""
                    } ${
                      isToday ? "bg-[rgba(var(--theme-accent-rgb),0.07)]" : ""
                    }`}
                    style={
                      isToday
                        ? {
                            outline: "1px solid var(--theme-accent)",
                            zIndex: 1,
                          }
                        : {}
                    }
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                          isToday ? "text-white" : "text-foreground"
                        }`}
                        style={isToday ? { backgroundColor: "var(--theme-accent)" } : {}}
                      >
                        {cellDate.getUTCDate()}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {cellEvents.slice(0, 2).map((event) => {
                        const badgeClass = getCategoryBadgeClass(event.cat);
                        return (
                          <div
                            key={event.id}
                            className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded border truncate font-medium text-right leading-tight ${badgeClass}`}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {cellEvents.length > 2 && (
                        <div className="text-[9px] text-[var(--theme-accent)] text-center font-bold">
                          +{cellEvents.length - 2} נוספים
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Popup Modal */}
          {selectedCellDate && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setSelectedCellDate(null)}
            >
              <div
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="font-bold text-foreground text-base">
                    אירועי {selectedCellDate.getUTCDate()} ב{MONTH_NAMES[selectedCellDate.getUTCMonth()]}
                  </div>
                  <button
                    onClick={() => setSelectedCellDate(null)}
                    className="text-muted-foreground hover:text-foreground text-sm p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedDateEvents.map((e) => {
                    const style = getCatStyle(e.cat);
                    return (
                      <div
                        key={e.id}
                        className="p-3 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-border/60 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground">{e.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                            {style.label}
                          </span>
                        </div>
                        {e.time && (
                          <div className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>
                            ⏰ {e.time}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          📅 {e.display}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
