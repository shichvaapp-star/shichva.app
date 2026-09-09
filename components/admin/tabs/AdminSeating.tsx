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

  // ── Load seating (real-time) ──
  useEffect(() => {
    const q = query(
      collection(db, "classes", classId, "seating"),
      orderBy("order")
    );
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeatingRow)));
      setLoading(false);
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
    if (seededRef.current || !rosterLoaded || rows.length === 0 || roster.length > 0) return;
    seededRef.current = true;
    const names = new Set<string>();
    rows.forEach((row) => {
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
  }, [rows, rosterLoaded, roster.length, classId]);

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
      batch.update(doc(db, "classes", classId, "seating", srcRowId), {
        [srcField]: targetName,
        [targetField]: srcName,
      });
    } else {
      batch.update(doc(db, "classes", classId, "seating", srcRowId), {
        [srcField]: targetName,
      });
      batch.update(doc(db, "classes", classId, "seating", targetRowId), {
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
    await updateDoc(doc(db, "classes", classId, "seating", targetRowId), {
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
    await updateDoc(doc(db, "classes", classId, "seating", adding.rowId), {
      [adding.field]: name,
    });
    setAdding(null);
    setAddingName("");
  }

  async function removeSeat(rowId: string, field: SeatField, name: string) {
    if (!confirm(`להסיר את ${name} מהמושב?`)) return;
    await updateDoc(doc(db, "classes", classId, "seating", rowId), {
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
      batch.update(doc(db, "classes", classId, "seating", row.id), updateData);
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
        batch.update(doc(db, "classes", classId, "seating", row.id), updateData);
      }
    });

    await batch.commit();
  }

  async function initializeSeating() {
    const colRef = collection(db, "classes", classId, "seating");
    const emptyRow = { desk1_right: "", desk1_left: "", desk2_right: "", desk2_left: "", desk3_right: "", desk3_left: "", desk4_right: "", desk4_left: "" };
    for (let i = 1; i <= 5; i++) {
      await addDoc(colRef, { order: i, ...emptyRow });
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
        <p className="text-muted-foreground text-sm text-center mb-4" style={{ fontSize: "0.78rem" }}>
          גרור תלמיד/ה מהרשימה לכיסא פנוי · גרור בין מושבות להחלפה · לחץ × להסרה
        </p>

        <div className="flex justify-center gap-3 mb-6 flex-wrap">
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
    </>
  );
}
