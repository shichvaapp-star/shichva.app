"use client";

import { useEffect, useRef, useState } from "react";
import AdminGuide from "@/components/admin/AdminGuide";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  doc,
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

interface Props {
  classId: string;
}

export default function AdminEmergencySchedule({ classId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Visibility toggle
  const [visible, setVisible] = useState(false);
  const [visLoading, setVisLoading] = useState(true);

  // Subjects palette
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  // Drag & drop
  const [dragSubject, setDragSubject] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");
  const [savingKey, setSavingKey] = useState("");

  // Inline time editing
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [timeValue, setTimeValue] = useState("");

  const [copying, setCopying] = useState(false);
  const mergedRef = useRef(false);

  const colRef = collection(db, "classes", classId, "emergency_schedule");
  const metaRef = doc(db, "classes", classId, "meta", "emergency");

  // Load schedule rows (real-time)
  useEffect(() => {
    const q = query(colRef, orderBy("order"));
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleRow)));
      setLoading(false);
    });
  }, [classId]);

  // Load visibility flag
  useEffect(() => {
    getDoc(metaRef).then((d) => {
      if (d.exists()) setVisible(d.data().visible ?? false);
      setVisLoading(false);
    });
  }, [classId]);

  // Load + merge subjects from regular schedule palette
  useEffect(() => {
    getDoc(doc(db, "classes", classId, "meta", "subjects")).then((d) => {
      if (d.exists()) setSubjects((d.data().list as string[]) ?? []);
    });
  }, [classId]);

  useEffect(() => {
    if (mergedRef.current || rows.length === 0) return;
    mergedRef.current = true;
    const fromRows = new Set<string>();
    rows.forEach((row) => {
      if (row.type === "הפסקה") return;
      DAYS.forEach((day) => { const v = row[day]?.trim(); if (v) fromRows.add(v); });
    });
    setSubjects((prev) => {
      const merged = [...new Set([...prev, ...fromRows])].filter(Boolean).sort((a, b) => a.localeCompare(b, "he"));
      return merged.length === prev.length ? prev : merged;
    });
  }, [rows]);

  // ── Visibility toggle ──
  async function toggleVisible() {
    const newVal = !visible;
    setVisible(newVal);
    await setDoc(metaRef, { visible: newVal }, { merge: true });
  }

  // ── Subjects ──
  async function addSubject() {
    const val = newSubject.trim();
    if (!val || subjects.includes(val)) return;
    setNewSubject("");
    const updated = [...subjects, val].sort((a, b) => a.localeCompare(b, "he"));
    setSubjects(updated);
  }

  function removeSubject(s: string) {
    setSubjects((prev) => prev.filter((x) => x !== s));
  }

  // ── Drag & drop ──
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
    await updateDoc(doc(db, "classes", classId, "emergency_schedule", rowId), { [day]: value });
    setSavingKey("");
  }

  // ── Copy from regular schedule ──
  async function copyFromRegular() {
    if (!confirm("להעתיק את המערכת הרגילה לכאן? תוכן המערכת הנוכחית יימחק.")) return;
    setCopying(true);
    const regularSnap = await getDocs(
      query(collection(db, "classes", classId, "schedule"), orderBy("order"))
    );
    if (regularSnap.empty) {
      alert("אין מערכת שעות רגילה להעתיק ממנה");
      setCopying(false);
      return;
    }
    // Delete existing emergency rows
    const existingSnap = await getDocs(colRef);
    if (!existingSnap.empty) {
      const del = writeBatch(db);
      existingSnap.docs.forEach((d) => del.delete(d.ref));
      await del.commit();
    }
    // Copy regular schedule rows
    const copy = writeBatch(db);
    regularSnap.docs.forEach((d) => copy.set(doc(colRef), d.data()));
    await copy.commit();
    setCopying(false);
  }

  // ── Add row / break ──
  async function addPeriodRow() {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) : 0;
    const nextPeriod = rows.filter((r) => r.type !== "הפסקה").length + 1;
    await addDoc(colRef, { order: maxOrder + 1, period: String(nextPeriod), time: "", type: "", sun: "", mon: "", tue: "", wed: "", thu: "", fri: "" });
  }

  async function addBreakRow() {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) : 0;
    await addDoc(colRef, { order: maxOrder + 1, period: "", time: "", type: "הפסקה", sun: "הפסקה", mon: "", tue: "", wed: "", thu: "", fri: "" });
  }

  async function deleteRow(rowId: string) {
    if (!confirm("למחוק שורה זו?")) return;
    await deleteDoc(doc(db, "classes", classId, "emergency_schedule", rowId));
  }

  async function saveTime(rowId: string) {
    await updateDoc(doc(db, "classes", classId, "emergency_schedule", rowId), { time: timeValue.trim() });
    setEditingTimeId(null);
  }

  if (loading || visLoading)
    return <p className="text-muted-foreground text-center py-12">טוען...</p>;

  return (
    <div className="flex flex-col gap-6">
      <AdminGuide items={[
        'לחץ "הצג באתר" כדי שהמערכת תופיע לתלמידים',
        "כשהיא מופעלת היא מוצגת מעל המערכת הרגילה",
        'לחץ "הסתר מהאתר" כשחוזרים ללימודים רגילים',
        "ניתן להעתיק את המערכת הרגילה כנקודת התחלה",
      ]} />
      {/* ── Visibility toggle card ── */}
      <div
        className="admin-card flex items-center justify-between gap-4"
        style={{
          borderColor: visible ? "rgba(251,146,60,0.45)" : undefined,
          background: visible ? "rgba(251,146,60,0.06)" : undefined,
        }}
      >
        <div>
          <p className="font-bold text-foreground mb-1">
            {visible ? "⚠️ המערכת מוצגת כרגע באתר" : "המערכת מוסתרת מהאתר"}
          </p>
          <p className="text-muted-foreground" style={{ fontSize: "0.82rem" }}>
            {visible
              ? "תלמידים רואים את מערכת החירום מעל המערכת הרגילה"
              : "לחץ כדי להציג את מערכת החירום באתר"}
          </p>
        </div>
        <button
          onClick={toggleVisible}
          className={visible ? "btn-danger" : "btn-primary"}
          style={{ whiteSpace: "nowrap", padding: "8px 20px" }}
        >
          {visible ? "הסתר מהאתר" : "הצג באתר"}
        </button>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 ? (
        <div className="admin-card text-center py-10 flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">אין שורות במערכת החירום עדיין.</p>
          <button className="btn-primary" onClick={copyFromRegular} disabled={copying} style={{ padding: "10px 28px" }}>
            {copying ? "מעתיק..." : "העתק מהמערכת הרגילה"}
          </button>
          <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
            יועתקו כל השורות מהמערכת הרגילה – ניתן לערוך לאחר מכן
          </p>
        </div>
      ) : (
        /* ── Schedule editor ── */
        <div className="admin-schedule-layout">
          {/* Palette */}
          <div className="admin-palette" style={{ borderColor: "rgba(251,146,60,0.25)" }}>
            <p className="admin-palette-title">מקצועות</p>
            <div className="admin-palette-list">
              {subjects.length === 0 && <p style={{ fontSize: "0.78rem", color: "#475569" }}>טרם נוספו</p>}
              {subjects.map((s) => (
                <div key={s} className="admin-palette-row">
                  <div
                    className={`admin-palette-chip${dragSubject === s ? " dragging" : ""}`}
                    style={{ background: "rgba(251,146,60,0.15)", borderColor: "rgba(251,146,60,0.3)", color: "#fdba74" }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", s); setDragSubject(s); }}
                    onDragEnd={() => { setDragSubject(""); setDragOverKey(""); }}
                  >
                    {s}
                  </div>
                  <button className="admin-palette-remove" onClick={() => removeSubject(s)}>×</button>
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
              <button className="btn-primary" onClick={addSubject} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>+ הוסף</button>
            </div>
          </div>

          {/* Table */}
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
                          onClick={() => { setEditingTimeId(row.id); setTimeValue(row.time); }}
                        >
                          {editingTimeId === row.id ? (
                            <input className="inline-input" value={timeValue} autoFocus onChange={(e) => setTimeValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveTime(row.id); if (e.key === "Escape") setEditingTimeId(null); }}
                              onBlur={() => saveTime(row.id)} style={{ width: 90, direction: "ltr" }} />
                          ) : row.time || <span style={{ color: "#334155" }}>--:--</span>}
                        </td>
                        <td colSpan={6}>{row.sun}</td>
                        <td><button className="admin-palette-remove" onClick={() => deleteRow(row.id)}>×</button></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.id}>
                      <td className="sched-period" style={{ color: "#fb923c" }}>{row.period}</td>
                      <td style={{ cursor: "pointer" }} onClick={() => { setEditingTimeId(row.id); setTimeValue(row.time); }}>
                        {editingTimeId === row.id ? (
                          <input className="inline-input" value={timeValue} autoFocus onChange={(e) => setTimeValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveTime(row.id); if (e.key === "Escape") setEditingTimeId(null); }}
                            onBlur={() => saveTime(row.id)} style={{ width: 90, direction: "ltr" }} />
                        ) : <span className="sched-time">{row.time || <span style={{ color: "#334155" }}>--:--</span>}</span>}
                      </td>
                      {DAYS.map((day) => {
                        const key = `${row.id}-${day}`;
                        const isOver = dragOverKey === key;
                        const isSaving = savingKey === key;
                        const val = row[day];
                        return (
                          <td key={day}
                            className={`sched-drop-cell${isOver ? " sched-drop-over" : ""}${!val ? " sched-drop-empty" : ""}`}
                            style={isOver ? { background: "rgba(251,146,60,0.2)", outlineColor: "rgba(251,146,60,0.6)" } : undefined}
                            onDragOver={(e) => { e.preventDefault(); if (dragSubject) setDragOverKey(key); }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(""); }}
                            onDrop={() => dropOnCell(row.id, day)}
                          >
                            {isSaving ? <span style={{ color: "#fb923c", fontSize: "0.72rem" }}>⟳</span> : (val || "")}
                          </td>
                        );
                      })}
                      <td><button className="admin-palette-remove" onClick={() => deleteRow(row.id)}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="btn-edit" onClick={addPeriodRow}>+ הוסף שיעור</button>
              <button className="btn-cancel" onClick={addBreakRow}>+ הוסף הפסקה</button>
              <button className="btn-danger" onClick={copyFromRegular} disabled={copying} style={{ marginRight: "auto" }}>
                {copying ? "מעתיק..." : "העתק מהמערכת הרגילה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
