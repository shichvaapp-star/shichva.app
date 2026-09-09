"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile, UserRole, UserStatus } from "@/types/user";

interface Props {
  classId: string;
}

export default function AdminUsers({ classId }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [whitelistEmails, setWhitelistEmails] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "approved" | "whitelist">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [newWhitelistInput, setNewWhitelistInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Subscribe to all users
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => {
          list.push({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) });
        });
        // Sort: pending first, then newest
        list.sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        setUsers(list);
      },
      (err) => console.error("Error fetching users:", err)
    );

    // Subscribe to whitelist
    const unsubscribeWhitelist = onSnapshot(
      doc(db, "classes", classId, "meta", "whitelist"),
      (snap) => {
        if (snap.exists()) {
          setWhitelistEmails((snap.data()?.emails || []) as string[]);
        } else {
          setWhitelistEmails([]);
        }
      },
      (err) => console.error("Error fetching whitelist:", err)
    );

    return () => {
      unsubscribeUsers();
      unsubscribeWhitelist();
    };
  }, [classId]);

  const pendingUsers = users.filter((u) => u.status === "pending");
  const approvedUsers = users.filter((u) => u.status === "approved" || u.status === "rejected");

  const filteredApprovedUsers = approvedUsers.filter((u) => {
    const matchesSearch =
      (u.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.studentName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  async function handleStatusChange(uid: string, status: UserStatus) {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        status,
        ...(status === "approved" ? { approvedAt: new Date().toISOString() } : {}),
      });
    } catch (err) {
      console.error("Error updating user status:", err);
      alert("שגיאה בעדכון סטטוס המשתמש");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role });
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("שגיאה בעדכון תפקיד המשתמש");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteUser(uid: string, name: string) {
    if (!confirm(`האם למחוק את המשתמש "${name}" לצמיתות?`)) return;
    setActionLoading(uid);
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("שגיאה במחיקת המשתמש");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddWhitelist() {
    if (!newWhitelistInput.trim()) return;

    // Parse comma or newline separated emails
    const rawList = newWhitelistInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (rawList.length === 0) {
      alert("נא להזין לפחות כתובת אימייל אחת תקינה");
      return;
    }

    const updated = Array.from(new Set([...whitelistEmails, ...rawList]));
    try {
      await setDoc(
        doc(db, "classes", classId, "meta", "whitelist"),
        { emails: updated },
        { merge: true }
      );
      setNewWhitelistInput("");
    } catch (err) {
      console.error("Error updating whitelist:", err);
      alert("שגיאה בשמירת הרשימה המורשית");
    }
  }

  async function handleRemoveWhitelist(emailToRemove: string) {
    const updated = whitelistEmails.filter((e) => e !== emailToRemove);
    try {
      await setDoc(
        doc(db, "classes", classId, "meta", "whitelist"),
        { emails: updated },
        { merge: true }
      );
    } catch (err) {
      console.error("Error removing email from whitelist:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">ניהול משתמשים והרשאות</h2>
          <p className="text-xs text-muted-foreground mt-1">
            אישור בקשות הצטרפות, מעקב אחר משתמשים רשומים ורשימת אימיילים מורשית מראש
          </p>
        </div>

        <div
          className="flex rounded-xl p-1 self-start"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setActiveSubTab("pending")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeSubTab === "pending"
                ? "bg-violet-600/40 text-violet-200 border border-violet-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>ממתינים לאישור</span>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-black font-bold text-[10px] rounded-full animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("approved")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeSubTab === "approved"
                ? "bg-violet-600/40 text-violet-200 border border-violet-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            משתמשים רשומים ({approvedUsers.length})
          </button>

          <button
            onClick={() => setActiveSubTab("whitelist")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeSubTab === "whitelist"
                ? "bg-violet-600/40 text-violet-200 border border-violet-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            אישור אוטומטי ({whitelistEmails.length})
          </button>
        </div>
      </div>

      {/* Subtab 1: Pending Approvals */}
      {activeSubTab === "pending" && (
        <div>
          {pendingUsers.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="font-semibold text-foreground text-sm">אין בקשות הרשמה הממתינות לאישור</h3>
              <p className="text-xs text-muted-foreground mt-1">
                כאשר תלמיד או הורה חדש יירשמו לאתר, בקשתם תופיע כאן לאישורך.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.uid}
                  className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{user.fullName}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          user.role === "parent"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {user.role === "parent" ? "הורה" : "תלמיד/ה"}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono" dir="ltr">{user.email}</span>
                      {user.role === "parent" && user.studentName && (
                        <span>שם התלמיד/ה: <strong className="text-foreground">{user.studentName}</strong></span>
                      )}
                      <span>
                        נרשם ב: {user.createdAt ? new Date(user.createdAt).toLocaleDateString("he-IL") : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleStatusChange(user.uid, "approved")}
                      disabled={actionLoading === user.uid}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      ✓ אשר כניסה
                    </button>
                    <button
                      onClick={() => handleStatusChange(user.uid, "rejected")}
                      disabled={actionLoading === user.uid}
                      className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      ✕ דחה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Approved / Registered Users */}
      {activeSubTab === "approved" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חיפוש לפי שם, אימייל או שם תלמיד..."
              className="flex-1 rounded-xl px-3.5 py-2 text-xs text-foreground outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs text-foreground outline-none cursor-pointer"
              style={{
                background: "rgba(20,20,35,0.9)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <option value="all">כל התפקידים</option>
              <option value="student">תלמידים בלבד</option>
              <option value="parent">הורים בלבד</option>
              <option value="admin">מנהלים / מורים</option>
            </select>
          </div>

          {/* Users List */}
          <div className="grid gap-2">
            {filteredApprovedUsers.length === 0 ? (
              <div className="rounded-xl p-8 text-center text-xs text-muted-foreground">
                לא נמצאו משתמשים התואמים את החיפוש.
              </div>
            ) : (
              filteredApprovedUsers.map((user) => (
                <div
                  key={user.uid}
                  className="rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{user.fullName}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          user.role === "admin"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : user.role === "parent"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {user.role === "admin" ? "מנהל/ת" : user.role === "parent" ? "הורה" : "תלמיד/ה"}
                      </span>
                      {user.status === "rejected" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                          חסום / נדחה
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3">
                      <span className="font-mono" dir="ltr">{user.email}</span>
                      {user.role === "parent" && user.studentName && (
                        <span>תלמיד/ה: {user.studentName}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {user.status === "approved" ? (
                      <button
                        onClick={() => handleStatusChange(user.uid, "rejected")}
                        disabled={actionLoading === user.uid}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10 border border-amber-500/30 transition-all cursor-pointer"
                        title="השהיית אישור הגישה"
                      >
                        הקפא גישה
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(user.uid, "approved")}
                        disabled={actionLoading === user.uid}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/30 transition-all cursor-pointer"
                      >
                        אשר מחדש
                      </button>
                    )}

                    {user.role !== "admin" && (
                      <button
                        onClick={() => handleRoleChange(user.uid, "admin")}
                        disabled={actionLoading === user.uid}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-violet-300 hover:bg-violet-500/10 border border-violet-500/30 transition-all cursor-pointer"
                        title="הענק הרשאות ניהול לאתר"
                      >
                        הפוך למנהל
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteUser(user.uid, user.fullName)}
                      disabled={actionLoading === user.uid}
                      className="px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="מחיקת משתמש"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subtab 3: Whitelist */}
      {activeSubTab === "whitelist" && (
        <div className="space-y-6">
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div>
              <h3 className="font-bold text-foreground text-sm">הוספת כתובות אימייל לאישור מיידי</h3>
              <p className="text-xs text-muted-foreground mt-1">
                תלמידים או הורים שיירשמו עם כתובת מתוך רשימה זו יאושרו מיידית ללא צורך בהמתנה. ניתן להדביק מספר כתובות מופרדות בפסיקים או שורות חדשות (למשל מתוך קובץ אקסל).
              </p>
            </div>

            <textarea
              rows={3}
              value={newWhitelistInput}
              onChange={(e) => setNewWhitelistInput(e.target.value)}
              placeholder="student1@school.org.il, parent@gmail.com, ..."
              className="w-full rounded-xl p-3 text-xs font-mono text-foreground outline-none resize-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              dir="ltr"
            />

            <button
              onClick={handleAddWhitelist}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-all cursor-pointer"
            >
              + הוסף לרשימה המורשית
            </button>
          </div>

          {/* Current Whitelist */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground text-sm">
                כתובות ברשימת האישור האוטומטי ({whitelistEmails.length})
              </h3>
            </div>

            {whitelistEmails.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין כרגע כתובות ברשימה המורשית.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {whitelistEmails.map((email) => (
                  <div
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    dir="ltr"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => handleRemoveWhitelist(email)}
                      className="text-muted-foreground hover:text-red-400 cursor-pointer text-xs"
                      title="הסר מהרשימה"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
