"use client";

import { useEffect, useRef, useState } from "react";
import AdminGuide from "@/components/admin/AdminGuide";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri"] as const;
const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
type Day = typeof DAYS[number];

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

const CLEAR = "__clear__";

// Default 8-period + 3-break structure (times left blank for teacher to fill)
const DEFAULT_ROWS = [
  { order: 1,  period: "1", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 2,  period: "",  time: "", type: "הפסקה",   sun: "הפסקה", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 3,  period: "2", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 4,  period: "3", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 5,  period: "",  time: "", type: "הפסקה",   sun: "הפסקה ארוכה", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 6,  period: "4", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 7,  period: "5", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 8,  period: "",  time: "", type: "הפסקה",   sun: "הפסקה", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 9,  period: "6", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 10, period: "7", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
  { order: 11, period: "8", time: "", type: "",        sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" },
];

interface Props {
  classId: string;
}

export default function AdminSchedule({ classId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [dragSubject, setDragSubject] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  // Inline time editing
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [timeValue, setTimeValue] = useState("");

  const mergedRef = useRef(false);

  const colRef = collection(db, "classes", classId, "schedule");

  useEffect(() => {
    const q = query(colRef, orderBy("order"));
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleRow)));
      setLoading(false);
    });
  }, [classId]);

  useEffect(() => {
    getDoc(doc(db, "classes", classId, "meta", "subjects")).then((d) => {
      if (d.exists()) setSubjects((d.data().list as string[]) ?? []);
    });
  }, [classId]);

  useEffect(() => {
    if (mergedRef.current || rows.length === 0) return;
    mergedRef.current = true;
    const fromSchedule = new Set<string>();
    rows.forEach((row) => {
      if (row.type === "הפסקה") return;
      DAYS.forEach((day) => { const v = row[day]?.trim(); if (v) fromSchedule.add(v); });
    });
    setSubjects((prev) => {
      const merged = [...new Set([...prev, ...fromSchedule])].filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));
      if (merged.length === prev.length) return prev;
      setDoc(doc(db, "classes", classId, "meta", "subjects"), { list: merged });
      return merged;
    });
  }, [rows, classId]);

  async function persistSubjects(list: string[]) {
    await setDoc(doc(db, "classes", classId, "meta", "subjects"), { list });
  }

  async function addSubject() {
    const val = newSubject.trim();
    if (!val) return;
    setNewSubject("");
    if (subjects.includes(val)) return;
    const updated = [...subjects, val].sort((a, b) => a.localeCompare(b, "he"));
    setSubjects(updated);
    await persistSubjects(updated);
  }

  async function removeSubject(s: string) {
    const updated = subjects.filter((x) => x !== s);
    setSubjects(updated);
    await persistSubjects(updated);
  }

  async function dropOnCell(rowId: string, day: Day) {
    if (!dragSubject) return;
    const key = `${rowId}-${day}`;
    setSavingKey(key);
    setDragOverKey("");
    let value: string;
    if (dragSubject === CLEAR) {
      value = "";
    } else {
      const row = rows.find((r) => r.id === rowId);
      const existing = row?.[day]?.trim() ?? "";
      value = existing ? `${existing}, ${dragSubject}` : dragSubject;
    }
    await updateDoc(doc(db, "classes", classId, "schedule", rowId), { [day]: value });
    setSavingKey("");
  }

  // ── Initialize empty schedule ──
  // Uses kita2's structure + times as a template, but clears all subject cells.
  // Falls back to DEFAULT_ROWS if kita2 has no data.
  async function initializeSchedule() {
    setInitializing(true);
    const templateSnap = await getDocs(
      query(collection(db, "classes", "kita2", "schedule"), orderBy("order"))
    );

    const batch = writeBatch(db);

    if (!templateSnap.empty) {
      templateSnap.docs.forEach((d) => {
        const data = d.data();
        const isBreak = data.type === "הפסקה";
        batch.set(doc(colRef), {
          order:  data.order  ?? 0,
          period: data.period ?? "",
          time:   data.time   ?? "",
          type:   data.type   ?? "",
          // Keep break label in sun; clear subject cells
          sun: isBreak ? (data.sun || "הפסקה") : "",
          mon: "", tue: "", wed: "", thu: "", fri: "",
        });
      });
    } else {
      // Fallback: default structure without times
      DEFAULT_ROWS.forEach((row) => batch.set(doc(colRef), row));
    }

    await batch.commit();
    setInitializing(false);
  }

  // ── Sync times from kita2 ──
  async function syncTimesFromKita2() {
    const templateSnap = await getDocs(
      query(collection(db, "classes", "kita2", "schedule"), orderBy("order"))
    );
    if (templateSnap.empty) {
      alert("לא נמצאו נתונים בכיתה ח׳2");
      return;
    }
    // Map order → time from kita2
    const timeByOrder: Record<number, string> = {};
    templateSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.time) timeByOrder[data.order as number] = data.time as string;
    });
    // Update matching rows in this class
    const batch = writeBatch(db);
    rows.forEach((row) => {
      const time = timeByOrder[row.order];
      if (time !== undefined && time !== row.time) {
        batch.update(doc(db, "classes", classId, "schedule", row.id), { time });
      }
    });
    await batch.commit();
  }

  // ── Add period / break row ──
  async function addPeriodRow() {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) : 0;
    const nextPeriod = rows.filter((r) => r.type !== "הפסקה").length + 1;
    await addDoc(colRef, { order: maxOrder + 1, period: String(nextPeriod), time: "", type: "", sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" });
  }

  async function addBreakRow() {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) : 0;
    await addDoc(colRef, { order: maxOrder + 1, period: "", time: "", type: "הפסקה", sun: "הפסקה", mon: "", tue: "", wed: "", thu: "", fri: "" });
  }

  // ── Delete row ──
  async function deleteRow(rowId: string) {
    if (!confirm("למחוק שורה זו?")) return;
    await deleteDoc(doc(db, "classes", classId, "schedule", rowId));
  }

  // ── Inline time save ──
  async function saveTime(rowId: string) {
    await updateDoc(doc(db, "classes", classId, "schedule", rowId), { time: timeValue.trim() });
    setEditingTimeId(null);
  }

  if (loading)
    return <p className="text-muted-foreground text-center py-12">טוען מערכת שעות...</p>;

  // ── Empty state ──
  if (rows.length === 0) {
    return (
      <div className="admin-card text-center py-12 flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">אין שורות במערכת השעות עדיין.</p>
        <button
          className="btn-primary"
          onClick={initializeSchedule}
          disabled={initializing}
          style={{ padding: "10px 28px" }}
        >
          {initializing ? "יוצר..." : "צור מערכת שעות ריקה (8 שיעורים)"}
        </button>
        <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
          יצירת 8 שיעורים + 3 הפסקות · מלא שעות ומקצועות לאחר מכן
        </p>
      </div>
    );
  }

  return (
    <>
    <AdminGuide items={[
      "גרור מקצוע מהרשימה בצד ושחרר על התא הרצוי בטבלה",
      "לשינוי שעה — לחץ על השעה בטבלה וערוך ישירות",
      'כדי לרוקן תא — גרור את "✕ מחק תא" על אותו תא',
      "ניתן להוסיף מקצועות חדשים לרשימה דרך השדה בתחתית",
    ]} />
    <div className="admin-schedule-layout">
      {/* ── Subject palette ── */}
      <div className="admin-palette">
        <p className="admin-palette-title">מקצועות</p>
        <div className="admin-palette-list">
          {subjects.length === 0 && <p style={{ fontSize: "0.78rem", color: "#475569" }}>טרם נוספו</p>}
          {subjects.map((s) => (
            <div key={s} className="admin-palette-row">
              <div
                className={`admin-palette-chip${dragSubject === s ? " dragging" : ""}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", s); setDragSubject(s); }}
                onDragEnd={() => { setDragSubject(""); setDragOverKey(""); }}
              >
                {s}
              </div>
              <button className="admin-palette-remove" onClick={() => removeSubject(s)} title="הסר">×</button>
            </div>
          ))}
        </div>
        <div
          className={`admin-palette-clear${dragSubject === CLEAR ? " dragging" : ""}`}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", CLEAR); setDragSubject(CLEAR); }}
          onDragEnd={() => { setDragSubject(""); setDragOverKey(""); }}
        >
          ✕ מחק תא
        </div>
        <div className="admin-palette-add">
          <input
            type="text"
            placeholder="מקצוע חדש..."
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
          />
          <button className="btn-primary" onClick={addSubject} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
            + הוסף
          </button>
        </div>
      </div>

      {/* ── Schedule table ── */}
      <div className="admin-sched-wrap">
        <table className="admin-sched-table">
          <thead>
            <tr>
              <th>שיעור</th>
              <th>שעות</th>
              {DAY_LABELS.map((d) => <th key={d}>{d}</th>)}
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === "הפסקה") {
                return (
                  <tr key={row.id} className="sched-break">
                    <td />
                    <td
                      style={{ cursor: "pointer" }}
                      title="לחץ לעריכת שעה"
                      onClick={() => { setEditingTimeId(row.id); setTimeValue(row.time); }}
                    >
                      {editingTimeId === row.id ? (
                        <input
                          className="inline-input"
                          value={timeValue}
                          autoFocus
                          onChange={(e) => setTimeValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveTime(row.id); if (e.key === "Escape") setEditingTimeId(null); }}
                          onBlur={() => saveTime(row.id)}
                          style={{ width: 90, direction: "ltr" }}
                        />
                      ) : (
                        row.time || <span style={{ color: "#334155" }}>--:--</span>
                      )}
                    </td>
                    <td colSpan={6}>{row.sun}</td>
                    <td>
                      <button className="admin-palette-remove" onClick={() => deleteRow(row.id)} title="מחק שורה">×</button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.id}>
                  <td className="sched-period">{row.period}</td>
                  <td
                    style={{ cursor: "pointer" }}
                    title="לחץ לעריכת שעה"
                    onClick={() => { setEditingTimeId(row.id); setTimeValue(row.time); }}
                  >
                    {editingTimeId === row.id ? (
                      <input
                        className="inline-input"
                        value={timeValue}
                        autoFocus
                        onChange={(e) => setTimeValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveTime(row.id); if (e.key === "Escape") setEditingTimeId(null); }}
                        onBlur={() => saveTime(row.id)}
                        style={{ width: 90, direction: "ltr" }}
                      />
                    ) : (
                      <span className="sched-time">{row.time || <span style={{ color: "#334155" }}>--:--</span>}</span>
                    )}
                  </td>
                  {DAYS.map((day) => {
                    const key = `${row.id}-${day}`;
                    const isOver = dragOverKey === key;
                    const isSaving = savingKey === key;
                    const val = row[day];
                    return (
                      <td
                        key={day}
                        className={`sched-drop-cell${isOver ? " sched-drop-over" : ""}${!val ? " sched-drop-empty" : ""}`}
                        onDragOver={(e) => { e.preventDefault(); if (dragSubject) setDragOverKey(key); }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(""); }}
                        onDrop={() => dropOnCell(row.id, day)}
                      >
                        {isSaving ? <span style={{ color: "#7c3aed", fontSize: "0.72rem" }}>⟳</span> : (val || "")}
                      </td>
                    );
                  })}
                  <td>
                    <button className="admin-palette-remove" onClick={() => deleteRow(row.id)} title="מחק שורה">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row + sync buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button className="btn-edit" onClick={addPeriodRow}>+ הוסף שיעור</button>
          <button className="btn-cancel" onClick={addBreakRow}>+ הוסף הפסקה</button>
          <button
            className="btn-save"
            onClick={syncTimesFromKita2}
            style={{ marginRight: "auto" }}
            title="העתק שעות מלוח הצלצולים"
          >
            קבל שעות מלוח הצלצולים
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
