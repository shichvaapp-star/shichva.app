"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminGuide from "@/components/admin/AdminGuide";

interface Teacher {
  id: string;
  order: number;
  name: string;
  subject: string;
  role: string;
  phone: string;
  email: string;
  notes?: string;
}

interface Props {
  classId: string;
}

export default function AdminTeachers({ classId }: Props) {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const colRef = collection(db, "classes", classId, "teachers");

  useEffect(() => {
    const q = query(colRef, orderBy("order"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, "id">) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [classId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 1;
    await addDoc(colRef, {
      order: nextOrder,
      name: newName.trim(),
      subject: newSubject.trim(),
      role: newRole.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      notes: newNotes.trim(),
    });
    setNewName("");
    setNewSubject("");
    setNewRole("");
    setNewPhone("");
    setNewEmail("");
    setNewNotes("");
    setSaving(false);
  }

  function startEdit(item: Teacher) {
    setEditId(item.id);
    setEditName(item.name);
    setEditSubject(item.subject);
    setEditRole(item.role);
    setEditPhone(item.phone);
    setEditEmail(item.email);
    setEditNotes(item.notes || "");
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit(item: Teacher) {
    setEditSaving(true);
    await updateDoc(doc(db, "classes", classId, "teachers", item.id), {
      name: editName.trim(),
      subject: editSubject.trim(),
      role: editRole.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      notes: editNotes.trim(),
    });
    setEditId(null);
    setEditSaving(false);
  }

  async function handleDelete(item: Teacher) {
    if (!confirm(`למחוק את "${item.name}"?`)) return;
    await deleteDoc(doc(db, "classes", classId, "teachers", item.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminGuide items={[
        "הוסף את פרטי כל מורה דרך הטופס",
        "מספר טלפון יהפוך אוטומטית לקישור לוואטסאפ",
        "אימייל יהפוך לקישור שליחת מייל",
        "הערות (למשל: שעות מענה וקבלת קהל) יוצגו בכרטיס המורה",
        'אם לא הוזנו פרטי קשר, יופיע הכיתוב "יש ליצור קשר במשוב"',
      ]} />
      {/* Add form */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-4">הוספת מורה</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>שם מלא *</label>
              <input
                type="text"
                placeholder="שם המורה"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>מקצוע</label>
              <input
                type="text"
                placeholder="למשל: מתמטיקה"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>תפקיד</label>
              <input
                type="text"
                placeholder="למשל: מחנך"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>טלפון / WhatsApp</label>
              <input
                type="text"
                placeholder="למשל: 050-1234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>אימייל</label>
              <input
                type="email"
                placeholder="teacher@school.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>הערות (שעות מענה וכו׳)</label>
              <input
                type="text"
                placeholder="למשל: זמין בימים א׳-ה׳ 16:00-18:00"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ alignSelf: "flex-end" }}
            >
              {saving ? "שומר..." : "+ הוסף מורה"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing list */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-4">צוות קיים</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">טוען...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">אין מורים עדיין.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>שם</th>
                  <th style={{ width: 100 }}>מקצוע</th>
                  <th style={{ width: 80 }}>תפקיד</th>
                  <th style={{ width: 110 }}>טלפון</th>
                  <th>אימייל</th>
                  <th>הערות</th>
                  <th style={{ width: 120 }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editId === item.id ? (
                    <tr key={item.id}>
                      <td>
                        <input
                          className="inline-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ minWidth: 110 }}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          style={{ minWidth: 90 }}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          style={{ minWidth: 75 }}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          style={{ width: 110 }}
                          dir="ltr"
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          style={{ minWidth: 140 }}
                          dir="ltr"
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="הערות..."
                          style={{ minWidth: 140 }}
                        />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-save"
                            onClick={() => saveEdit(item)}
                            disabled={editSaving}
                          >
                            {editSaving ? "..." : "שמור"}
                          </button>
                          <button className="btn-cancel" onClick={cancelEdit}>
                            ביטול
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td style={{ color: "var(--color-muted-foreground)" }}>{item.subject || "—"}</td>
                      <td>
                        {item.role ? (
                          <span style={{
                            fontSize: "0.78em",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(124,58,237,0.2)",
                            color: "#c4b5fd",
                            whiteSpace: "nowrap",
                          }}>
                            {item.role}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="cell-nowrap cell-dim" style={{ direction: "ltr" }}>
                        {item.phone || "—"}
                      </td>
                      <td className="cell-trunc cell-dim" style={{ direction: "ltr" }}>
                        {item.email || "—"}
                      </td>
                      <td className="cell-trunc cell-dim" style={{ maxWidth: 150 }} title={item.notes}>
                        {item.notes || "—"}
                      </td>
                      <td className="cell-nowrap">
                        <div className="flex gap-2">
                          <button className="btn-edit" onClick={() => startEdit(item)}>עריכה</button>
                          <button className="btn-danger" onClick={() => handleDelete(item)}>מחיקה</button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
