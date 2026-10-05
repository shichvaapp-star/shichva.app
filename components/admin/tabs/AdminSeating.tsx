"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminGuide from "@/components/admin/AdminGuide";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDoc,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminSeatingSurveyModal from "@/components/admin/tabs/AdminSeatingSurveyModal";
import { generateAutoSeating } from "@/lib/seatingAlgorithm";
import { SeatingRequestItem, SeatingSurveyMeta } from "@/types/seating-request";

type SeatField =
  | "desk1_right" | "desk1_left"
  | "desk2_right" | "desk2_left"
  | "desk3_right" | "desk3_left"
  | "desk4_right" | "desk4_left";

interface SeatingRow {
  id: string;
  order: number;
  desk1_right: string; desk1_left: string;
  desk2_right: string; desk2_left: string;
  desk3_right: string; desk3_left: string;
  desk4_right: string; desk4_left: string;
}

const DESK_PAIRS: [SeatField, SeatField][] = [
  ["desk1_right", "desk1_left"],
  ["desk2_right", "desk2_left"],
  ["desk3_right", "desk3_left"],
  ["desk4_right", "desk4_left"],
];

interface DragSrc {
  rowId: string;
  field: SeatField;
  name: string;
}

interface Adding {
  rowId: string;
  field: SeatField;
}

function heSort(a: string, b: string) {
  return a.localeCompare(b, "he");
}

interface Props {
  classId: string;
}

export default function AdminSeating({ classId }: Props) {
  const [rows, setRows] = useState<SeatingRow[]>([]);
  const [publishedRows, setPublishedRows] = useState<SeatingRow[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [publishedLoaded, setPublishedLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Roster
  const [roster, setRoster] = useState<string[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");

  // Drag — from grid
  const [dragSrc, setDragSrc] = useState<DragSrc | null>(null);
  // Drag — from sidebar
  const [dragFromSidebar, setDragFromSidebar] = useState("");

  const [dragOverKey, setDragOverKey] = useState("");
  const [adding, setAdding] = useState<Adding | null>(null);
  const [addingName, setAddingName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── Seating Survey state ──
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyRequests, setSurveyRequests] = useState<Record<string, SeatingRequestItem>>({});

  // ── Load seating draft (real-time for admin editing) ──
  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "seating_draft"),
      orderBy("order")
    );
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeatingRow)));
      setDraftLoaded(true);
      setLoading(false);
    });
  }, [classId]);

  // ── Load published seating (to check difference from live site) ──
  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "seating"),
      orderBy("order")
    );
    return onSnapshot(q, (snap) => {
      setPublishedRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeatingRow)));
      setPublishedLoaded(true);
    });
  }, [classId]);

  // ── Load seating meta (last published timestamp) ──
  useEffect(() => {
    return onSnapshot(doc(db, "classes", classId, "meta", "seating_meta"), (snap) => {
      if (snap.exists()) {
        setLastPublishedAt(snap.data()?.lastPublishedAt || null);
      }
    });
  }, [classId]);

  // ── Copy published seating to draft on initial load if draft is empty ──
  const draftSeededRef = useRef(false);
  useEffect(() => {
    if (draftSeededRef.current || !draftLoaded || !publishedLoaded) return;
    if (rows.length === 0 && publishedRows.length > 0) {
      draftSeededRef.current = true;
      const batch = writeBatch(db);
      publishedRows.forEach((row) => {
        batch.set(doc(db, "classes", classId, "seating_draft", row.id), {
          order: row.order,
          desk1_right: row.desk1_right || "",
          desk1_left: row.desk1_left || "",
          desk2_right: row.desk2_right || "",
          desk2_left: row.desk2_left || "",
          desk3_right: row.desk3_right || "",
          desk3_left: row.desk3_left || "",
          desk4_right: row.desk4_right || "",
          desk4_left: row.desk4_left || "",
        });
      });
      batch.commit().catch((err) => console.error("Error copying to draft:", err));
    }
  }, [draftLoaded, publishedLoaded, rows.length, publishedRows, classId]);

  // ── Load seating survey meta ──
  useEffect(() => {
    return onSnapshot(doc(db, "classes", classId, "meta", "seating_survey"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SeatingSurveyMeta;
        setSurveyRequests(data.requests || {});
      }
    });
  }, [classId]);

  // ── Load roster from Firestore ──
  useEffect(() => {
    getDoc(doc(db, "classes", classId, "meta", "students")).then((d) => {
      if (d.exists()) setRoster((d.data().list as string[]) ?? []);
      setRosterLoaded(true);
    });
  }, [classId]);

  // ── Seed roster from current seating on first load if roster is empty ──
  const seededRef = useRef(false);
  useEffect(() => {
    const sourceRows = rows.length > 0 ? rows : publishedRows;
    if (seededRef.current || !rosterLoaded || sourceRows.length === 0 || roster.length > 0) return;
    seededRef.current = true;
    const names = new Set<string>();
    sourceRows.forEach((row) => {
      DESK_PAIRS.forEach(([r, l]) => {
        if (row[r]?.trim()) names.add(row[r].trim());
        if (row[l]?.trim()) names.add(row[l].trim());
      });
    });
    const list = [...names].sort(heSort);
    if (list.length > 0) {
      setRoster(list);
      setDoc(doc(db, "classes", classId, "meta", "students"), { list });
    }
  }, [rows, publishedRows, rosterLoaded, roster.length, classId]);

  // Auto-focus seat input
  useEffect(() => {
    if (adding) setTimeout(() => addInputRef.current?.focus(), 0);
  }, [adding]);

  // ── Computed ──
  const assigned = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) =>
      DESK_PAIRS.forEach(([r, l]) => {
        if (row[r]?.trim()) set.add(row[r].trim());
        if (row[l]?.trim()) set.add(row[l].trim());
      })
    );
    return set;
  }, [rows]);

  const unassigned = useMemo(
    () => roster.filter((n) => !assigned.has(n)).sort(heSort),
    [roster, assigned]
  );

  // ── Roster helpers ──
  async function saveRoster(list: string[]) {
    await setDoc(doc(db, "classes", classId, "meta", "students"), { list });
  }

  async function addStudent() {
    const name = newStudentName.trim();
    if (!name || roster.includes(name)) return;
    setNewStudentName("");
    const updated = [...roster, name].sort(heSort);
    setRoster(updated);
    await saveRoster(updated);
  }

  async function removeFromRoster(name: string) {
    if (!confirm(`להסיר את ${name} מהרשימה?`)) return;
    const updated = roster.filter((x) => x !== name);
    setRoster(updated);
    await saveRoster(updated);
  }

  // ── Grid drag & drop ──
  function cellKey(rowId: string, field: SeatField) {
    return `${rowId}::${field}`;
  }

  async function handleGridDrop(targetRowId: string, targetField: SeatField) {
    if (!dragSrc) return;
    const { rowId: srcRowId, field: srcField, name: srcName } = dragSrc;
    if (srcRowId === targetRowId && srcField === targetField) {
      setDragOverKey("");
      return;
    }
    const targetRow = rows.find((r) => r.id === targetRowId);
    const targetName = targetRow ? targetRow[targetField] || "" : "";
    const batch = writeBatch(db);
    if (srcRowId === targetRowId) {
      batch.update(doc(db, "classes", classId, "seating_draft", srcRowId), {
        [srcField]: targetName,
        [targetField]: srcName,
      });
    } else {
      batch.update(doc(db, "classes", classId, "seating_draft", srcRowId), {
        [srcField]: targetName,
      });
      batch.update(doc(db, "classes", classId, "seating_draft", targetRowId), {
        [targetField]: srcName,
      });
    }
    await batch.commit();
    setDragSrc(null);
    setDragOverKey("");
  }

  // ── Sidebar drag & drop (empty seats only) ──
  async function handleSidebarDrop(targetRowId: string, targetField: SeatField) {
    if (!dragFromSidebar) return;
    await updateDoc(doc(db, "classes", classId, "seating_draft", targetRowId), {
      [targetField]: dragFromSidebar,
    });
    setDragFromSidebar("");
    setDragOverKey("");
  }

  // ── Add via seat + button ──
  async function confirmAdd() {
    const name = addingName.trim();
    if (!name || !adding) {
      setAdding(null);
      setAddingName("");
      return;
    }
    // Also register in roster if not present
    if (!roster.includes(name)) {
      const updatedRoster = [...roster, name].sort(heSort);
      setRoster(updatedRoster);
      await saveRoster(updatedRoster);
    }
    await updateDoc(doc(db, "classes", classId, "seating_draft", adding.rowId), {
      [adding.field]: name,
    });
    setAdding(null);
    setAddingName("");
  }

  async function removeSeat(rowId: string, field: SeatField, name: string) {
    if (!confirm(`להסיר את ${name} מהמושב?`)) return;
    await updateDoc(doc(db, "classes", classId, "seating_draft", rowId), {
      [field]: "",
    });
  }

  async function clearAllSeats() {
    if (!confirm("האם אתה בטוח שברצונך להסיר את כל התלמידים ממקומות הישיבה?")) return;
    const batch = writeBatch(db);
    rows.forEach((row) => {
      const updateData: Record<string, string> = {};
      DESK_PAIRS.forEach(([r, l]) => {
        updateData[r] = "";
        updateData[l] = "";
      });
      batch.update(doc(db, "classes", classId, "seating_draft", row.id), updateData);
    });
    await batch.commit();
  }

  async function randomizeSeating() {
    if (unassigned.length === 0) {
      alert("אין תלמידים לא משובצים לשיבוץ");
      return;
    }

    let emptySeatsCount = 0;
    rows.forEach((row) => {
      DESK_PAIRS.forEach(([r, l]) => {
        if (!row[r]) emptySeatsCount++;
        if (!row[l]) emptySeatsCount++;
      });
    });

    if (emptySeatsCount === 0) {
      alert("אין מקומות פנויים בכיתה");
      return;
    }

    if (!confirm(`האם לשבץ באקראי את ${unassigned.length} התלמידים הלא משובצים במקומות הפנויים?`)) return;

    // Shuffle only the unassigned students
    const shuffledUnassigned = [...unassigned].sort(() => Math.random() - 0.5);

    const batch = writeBatch(db);
    let studentIdx = 0;

    [...rows].reverse().forEach((row) => {
      const updateData: Record<string, string> = {};
      let hasUpdate = false;

      DESK_PAIRS.forEach(([r, l]) => {
        if (!row[r] && studentIdx < shuffledUnassigned.length) {
          updateData[r] = shuffledUnassigned[studentIdx];
          studentIdx++;
          hasUpdate = true;
        }
        if (!row[l] && studentIdx < shuffledUnassigned.length) {
          updateData[l] = shuffledUnassigned[studentIdx];
          studentIdx++;
          hasUpdate = true;
        }
      });

      if (hasUpdate) {
        batch.update(doc(db, "classes", classId, "seating_draft", row.id), updateData);
      }
    });

    await batch.commit();
  }

  const submittedSurveyCount = useMemo(() => {
    return Object.values(surveyRequests).filter((r) => r.eligible && r.choice1).length;
  }, [surveyRequests]);

  async function applyAutoSeating(requestsToApply?: Record<string, SeatingRequestItem>) {
    const reqs = requestsToApply || surveyRequests;
    const reqCount = Object.values(reqs).filter((r) => r.eligible && r.choice1).length;

    if (reqCount === 0) {
      alert("טרם התקבלו בקשות מתלמידים זכאים בסקר.");
      return;
    }

    const result = generateAutoSeating(rows, roster, reqs);

    const confirmMsg = `האלגוריתם סידר מקומות ישיבה:\n• ${result.mutualPairsCount} זוגות בהתאמה הדדית (בחרו זה את זה)\n• ${result.oneWayCount} תלמידים שובצו לפי בקשה אישית\n• ${result.totalPlaced} סה"כ תלמידים שובצו בכיתה\n\nהאם להחיל את הסידור על הלוח כעת? (השינויים יישמרו כטיוטה בבקאנד ויופיעו באתר רק לאחר לחיצה על "עדכן באתר")`;

    if (!confirm(confirmMsg)) return;

    const batch = writeBatch(db);
    result.updatedRows.forEach((row) => {
      batch.update(doc(db, "classes", classId, "seating_draft", row.id), {
        desk1_right: row.desk1_right,
        desk1_left: row.desk1_left,
        desk2_right: row.desk2_right,
        desk2_left: row.desk2_left,
        desk3_right: row.desk3_right,
        desk3_left: row.desk3_left,
        desk4_right: row.desk4_right,
        desk4_left: row.desk4_left,
      });
    });

    await batch.commit();
  }

  // ── Unpublished changes detection ──
  const hasUnpublishedChanges = useMemo(() => {
    if (!draftLoaded || !publishedLoaded) return false;
    if (rows.length === 0) return false;
    if (publishedRows.length === 0) return true;
    if (rows.length !== publishedRows.length) return true;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const p = publishedRows.find((x) => x.id === r.id) || publishedRows[i];
      if (!p) return true;
      for (const [rf, lf] of DESK_PAIRS) {
        if ((r[rf] || "") !== (p[rf] || "")) return true;
        if ((r[lf] || "") !== (p[lf] || "")) return true;
      }
    }
    return false;
  }, [draftLoaded, publishedLoaded, rows, publishedRows]);

  // ── Publish draft to live website ──
  async function publishToSite() {
    if (rows.length === 0) return;
    setPublishing(true);
    try {
      const batch = writeBatch(db);
      rows.forEach((row) => {
        batch.set(doc(db, "classes", classId, "seating", row.id), {
          order: row.order,
          desk1_right: row.desk1_right || "",
          desk1_left: row.desk1_left || "",
          desk2_right: row.desk2_right || "",
          desk2_left: row.desk2_left || "",
          desk3_right: row.desk3_right || "",
          desk3_left: row.desk3_left || "",
          desk4_right: row.desk4_right || "",
          desk4_left: row.desk4_left || "",
        });
      });
      batch.set(
        doc(db, "classes", classId, "meta", "seating_meta"),
        { lastPublishedAt: new Date().toISOString() },
        { merge: true }
      );
      await batch.commit();
      alert("✓ מקומות הישיבה עודכנו ופורסמו בהצלחה באתר הכיתה!");
    } catch (err) {
      console.error("Error publishing seating to site:", err);
      alert("שגיאה בעדכון מקומות הישיבה באתר");
    } finally {
      setPublishing(false);
    }
  }

  // ── Revert draft to published ──
  async function revertToPublished() {
    if (publishedRows.length === 0) {
      alert("אין גרסה מפורסמת לשחזור ממנה");
      return;
    }
    if (!confirm("האם לבטל את כל השינויים שלא פורסמו ולשחזר את סידור המקומות המופיע כרגע באתר?")) return;
    try {
      const batch = writeBatch(db);
      publishedRows.forEach((row) => {
        batch.set(doc(db, "classes", classId, "seating_draft", row.id), {
          order: row.order,
          desk1_right: row.desk1_right || "",
          desk1_left: row.desk1_left || "",
          desk2_right: row.desk2_right || "",
          desk2_left: row.desk2_left || "",
          desk3_right: row.desk3_right || "",
          desk3_left: row.desk3_left || "",
          desk4_right: row.desk4_right || "",
          desk4_left: row.desk4_left || "",
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error reverting seating to published:", err);
      alert("שגיאה בשחזור הנתונים מהאתר");
    }
  }

  async function initializeSeating() {
    const draftColRef = collection(db, "classes", classId, "seating_draft");
    const emptyRow = { desk1_right: "", desk1_left: "", desk2_right: "", desk2_left: "", desk3_right: "", desk3_left: "", desk4_right: "", desk4_left: "" };
    for (let i = 1; i <= 5; i++) {
      const docRef = await addDoc(draftColRef, { order: i, ...emptyRow });
      await setDoc(doc(db, "classes", classId, "seating", docRef.id), { order: i, ...emptyRow });
    }
  }

  if (loading)
    return <p className="text-muted-foreground text-center py-12">טוען...</p>;

  if (rows.length === 0) {
    return (
      <div className="admin-card text-center py-12 flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">אין שורות ישיבה עדיין.</p>
        <button
          className="btn-primary"
          onClick={initializeSeating}
          style={{ padding: "10px 28px" }}
        >
          צור רשת ישיבה ריקה (5 שורות)
        </button>
        <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
          יצירת 5 שורות × 4 שולחנות × 2 מושבות · גרור תלמידים למקומות לאחר מכן
        </p>
      </div>
    );
  }

  const totalRows = rows.length;
  const isDraggingAnything = !!dragSrc || !!dragFromSidebar;

  return (
    <>
    <AdminGuide items={[
      "גרור שם תלמיד/ה מהרשימה בצד ושחרר על מושב פנוי",
      "גרור בין שני מושבות כדי להחליף ביניהם",
      'לחץ על "+" על מושב ריק כדי להקליד שם ישירות',
      "לחץ × כדי לפנות מושב",
    ]} />
    <div className="admin-schedule-layout">
      {/* ── Sidebar (right in RTL) ── */}
      <div className="admin-palette">
        <p className="admin-palette-title">
          לא משובצים
          {unassigned.length > 0 && (
            <span style={{ color: "#7c3aed", marginRight: 4 }}>({unassigned.length})</span>
          )}
        </p>

        <div className="admin-palette-list">
          {unassigned.length === 0 && (
            <p style={{ fontSize: "0.78rem", color: "#475569" }}>
              {roster.length === 0 ? "אין תלמידים ברשימה" : "כולם משובצים ✓"}
            </p>
          )}
          {unassigned.map((name) => (
            <div key={name} className="admin-palette-row">
              <div
                className={`admin-palette-chip${dragFromSidebar === name ? " dragging" : ""}`}
                draggable
                onDragStart={() => setDragFromSidebar(name)}
                onDragEnd={() => {
                  setDragFromSidebar("");
                  setDragOverKey("");
                }}
              >
                {name}
              </div>
              <button
                className="admin-palette-remove"
                title="הסר מהרשימה"
                onClick={() => removeFromRoster(name)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="admin-palette-add">
          <input
            type="text"
            placeholder="שם תלמיד/ה..."
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStudent()}
          />
          <button
            className="btn-primary"
            onClick={addStudent}
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
          >
            + הוסף
          </button>
        </div>
      </div>

      {/* ── Seating grid (left in RTL) ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-muted-foreground text-sm text-center mb-3" style={{ fontSize: "0.78rem" }}>
          גרור תלמיד/ה מהרשימה לכיסא פנוי · גרור בין מושבות להחלפה · השינויים נשמרים כטיוטה ומתפרסמים באתר רק בלחיצה על &quot;עדכן באתר&quot;
        </p>

        {hasUnpublishedChanges && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-in shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                <strong>ישנם שינויים שממתינים לעדכון באתר:</strong> השינויים שביצעת מוצגים כרגע רק כאן בפאנל. האתר מציג את הגרסה הקודמת עד ללחיצה על &quot;עדכן באתר&quot;.
              </span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={revertToPublished}
                className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 text-foreground transition-all cursor-pointer font-medium"
              >
                ↩️ שחזר מהאתר
              </button>
              <button
                onClick={publishToSite}
                disabled={publishing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>{publishing ? "מעדכן באתר..." : "עדכן באתר עכשיו"}</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-3 mb-4 flex-wrap items-center">
          {/* Main Publish Button */}
          <button
            onClick={publishToSite}
            disabled={publishing || !hasUnpublishedChanges}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              hasUnpublishedChanges
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer animate-pulse"
                : "bg-black/5 dark:bg-white/5 text-muted-foreground border border-black/10 dark:border-white/10 opacity-70 cursor-not-allowed"
            }`}
            title={hasUnpublishedChanges ? "פרסם את השינויים הנוכחיים לאתר הכיתה" : "האתר מעודכן"}
          >
            <span>{publishing ? "⏳" : hasUnpublishedChanges ? "🚀" : "✓"}</span>
            <span>
              {publishing
                ? "מעדכן..."
                : hasUnpublishedChanges
                ? "עדכן באתר"
                : "מעודכן באתר"}
            </span>
          </button>

          <button
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            onClick={() => setSurveyModalOpen(true)}
          >
            <span>📋</span>
            <span>סקר ובקשות תלמידים</span>
            {submittedSurveyCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-400 text-black font-bold text-[10px] rounded-full">
                {submittedSurveyCount}
              </span>
            )}
          </button>

          {submittedSurveyCount > 0 && (
            <button
              className="px-3.5 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5"
              onClick={() => applyAutoSeating()}
              title="סדר את הכיתה אוטומטית לפי הבקשות שהתקבלו"
            >
              <span>✨</span>
              <span>סדר לפי בקשות</span>
            </button>
          )}

          <button
            className="btn-primary"
            onClick={randomizeSeating}
            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
          >
            🔀 חלוקה רנדומלית
          </button>
          <button
            className="btn-danger"
            onClick={clearAllSeats}
            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
          >
            🗑️ הסרת כל התלמידים
          </button>
        </div>

        {lastPublishedAt && (
          <p className="text-[11px] text-muted-foreground text-center mb-4">
            עודכן לאחרונה באתר: {new Date(lastPublishedAt).toLocaleDateString("he-IL", { dateStyle: "short", timeStyle: "short" })}
          </p>
        )}

        {rows.map((row, rowIdx) => (
          <div key={row.id} className="admin-seating-row">
            <span className="admin-row-label">שורה {totalRows - rowIdx}</span>
            <div className="admin-desks">
              {DESK_PAIRS.map(([rightField, leftField], deskIdx) => (
                <div key={deskIdx} className="admin-desk">
                  {([rightField, leftField] as SeatField[]).map((field) => {
                    const key = cellKey(row.id, field);
                    const name = row[field] || "";
                    const isOver = dragOverKey === key;
                    const isDraggingSelf =
                      dragSrc?.rowId === row.id && dragSrc?.field === field;
                    const isAdding =
                      adding?.rowId === row.id && adding?.field === field;

                    // ── Adding mode ──
                    if (isAdding) {
                      return (
                        <div key={field} className="admin-seat admin-seat-adding">
                          <input
                            ref={addInputRef}
                            className="admin-seat-input"
                            value={addingName}
                            onChange={(e) => setAddingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmAdd();
                              if (e.key === "Escape") {
                                setAdding(null);
                                setAddingName("");
                              }
                            }}
                            placeholder="שם..."
                          />
                          <button
                            className="admin-seat-confirm"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              confirmAdd();
                            }}
                          >
                            ✓
                          </button>
                        </div>
                      );
                    }

                    // ── Empty seat ──
                    if (!name) {
                      return (
                        <div
                          key={field}
                          className={`admin-seat admin-seat-empty${isOver ? " drag-over" : ""}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (isDraggingAnything) setDragOverKey(key);
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node))
                              setDragOverKey("");
                          }}
                          onDrop={() => {
                            if (dragFromSidebar) handleSidebarDrop(row.id, field);
                            else handleGridDrop(row.id, field);
                          }}
                          onClick={() => {
                            if (isDraggingAnything) return;
                            setAdding({ rowId: row.id, field });
                            setAddingName("");
                          }}
                        >
                          <span className="admin-seat-plus">+</span>
                        </div>
                      );
                    }

                    // ── Occupied seat ──
                    return (
                      <div
                        key={field}
                        className={`admin-seat admin-seat-occupied${isDraggingSelf ? " dragging" : ""}${isOver ? " drag-over" : ""}`}
                        draggable
                        onDragStart={() =>
                          setDragSrc({ rowId: row.id, field, name })
                        }
                        onDragEnd={() => {
                          setDragSrc(null);
                          setDragOverKey("");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          // Only grid-to-grid swaps on occupied seats
                          if (dragSrc && !isDraggingSelf) setDragOverKey(key);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node))
                            setDragOverKey("");
                        }}
                        onDrop={() => {
                          if (dragFromSidebar) return; // sidebar can't drop on occupied
                          handleGridDrop(row.id, field);
                        }}
                      >
                        <span className="admin-seat-name">{name}</span>
                        <button
                          className="admin-seat-remove"
                          title="הסר מהמושב"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSeat(row.id, field, name);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="admin-seating-footer">
          <div className="admin-seating-door">דלת</div>
          <div className="admin-seating-board">לוח</div>
        </div>
      </div>
    </div>

    <AdminSeatingSurveyModal
      classId={classId}
      roster={roster}
      isOpen={surveyModalOpen}
      onClose={() => setSurveyModalOpen(false)}
      onApplyAutoSeating={(reqs) => applyAutoSeating(reqs)}
    />
    </>
  );
}
