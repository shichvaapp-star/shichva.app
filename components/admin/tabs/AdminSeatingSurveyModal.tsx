"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SeatingRequestItem, SeatingSurveyMeta } from "@/types/seating-request";

interface Props {
  classId: string;
  roster: string[];
  isOpen: boolean;
  onClose: () => void;
  onApplyAutoSeating: (requests: Record<string, SeatingRequestItem>) => void;
}

function generateToken() {
  return Math.random().toString(36).substring(2, 10);
}

export default function AdminSeatingSurveyModal({
  classId,
  roster,
  isOpen,
  onClose,
  onApplyAutoSeating,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [surveyMeta, setSurveyMeta] = useState<SeatingSurveyMeta>({
    isActive: true,
    updatedAt: new Date().toISOString(),
    requests: {},
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Load survey data from Firestore
  useEffect(() => {
    if (!isOpen) return;

    async function loadSurvey() {
      try {
        setLoading(true);
        const ref = doc(db, "classes", classId, "meta", "seating_survey");
        const snap = await getDoc(ref);

        let data: SeatingSurveyMeta;
        if (snap.exists()) {
          data = snap.data() as SeatingSurveyMeta;
        } else {
          data = {
            isActive: true,
            updatedAt: new Date().toISOString(),
            requests: {},
          };
        }

        // Synchronize roster: make sure all roster students exist in requests mapping
        const currentRequests = { ...(data.requests || {}) };
        let hasChanges = false;

        roster.forEach((name) => {
          if (!currentRequests[name]) {
            currentRequests[name] = {
              token: generateToken(),
              studentName: name,
              eligible: false,
              createdAt: new Date().toISOString(),
            };
            hasChanges = true;
          }
        });

        const syncedData: SeatingSurveyMeta = {
          ...data,
          requests: currentRequests,
        };

        setSurveyMeta(syncedData);

        if (hasChanges && snap.exists()) {
          await setDoc(ref, syncedData, { merge: true });
        }
      } catch (err) {
        console.error("Error loading seating survey:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSurvey();
  }, [classId, isOpen, roster]);

  const saveSurvey = async (updated: SeatingSurveyMeta) => {
    setSaving(true);
    try {
      setSurveyMeta(updated);
      const ref = doc(db, "classes", classId, "meta", "seating_survey");
      await setDoc(ref, updated, { merge: true });
    } catch (err) {
      console.error("Error saving survey:", err);
      alert("שגיאה בשמירת השינויים");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    saveSurvey({
      ...surveyMeta,
      isActive: !surveyMeta.isActive,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleEligible = (studentName: string) => {
    const current = surveyMeta.requests[studentName];
    if (!current) return;

    const updated = {
      ...surveyMeta,
      requests: {
        ...surveyMeta.requests,
        [studentName]: {
          ...current,
          eligible: !current.eligible,
          token: current.token || generateToken(),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    saveSurvey(updated);
  };

  const handleSelectAll = (eligible: boolean) => {
    const updatedRequests = { ...surveyMeta.requests };
    roster.forEach((name) => {
      if (updatedRequests[name]) {
        updatedRequests[name] = {
          ...updatedRequests[name],
          eligible,
          token: updatedRequests[name].token || generateToken(),
        };
      }
    });

    saveSurvey({
      ...surveyMeta,
      requests: updatedRequests,
      updatedAt: new Date().toISOString(),
    });
  };

  // Identify mutual selections
  const mutualStudents = useMemo(() => {
    const set = new Set<string>();
    const reqs = surveyMeta.requests || {};

    Object.values(reqs).forEach((reqA) => {
      if (!reqA.eligible) return;
      const c1A = reqA.choice1?.trim();
      const c2A = reqA.choice2?.trim();

      [c1A, c2A].forEach((targetName) => {
        if (!targetName) return;
        const reqB = reqs[targetName];
        if (!reqB || !reqB.eligible) return;

        const c1B = reqB.choice1?.trim();
        const c2B = reqB.choice2?.trim();

        if (c1B === reqA.studentName || c2B === reqA.studentName) {
          set.add(`${reqA.studentName}::${targetName}`);
          set.add(`${targetName}::${reqA.studentName}`);
        }
      });
    });

    return set;
  }, [surveyMeta.requests]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const getStudentLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const classParam = classId ? `&classId=${encodeURIComponent(classId)}` : "";
    return `${origin}/seat-request?token=${token}${classParam}`;
  };

  const getWhatsAppMessage = (name: string, token: string) => {
    const link = getStudentLink(token);
    return `היי ${name}! 🌟 בעקבות התנהגותך הטובה ואחריותך האישית בכיתה, המורה מעניק/ה לך אפשרות לבחור ליד מי תרצה לשבת בסבב הקרוב. היכנס/י לקישור ובחר/י:\n${link}`;
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return roster.filter((name) =>
      name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [roster, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const reqs = Object.values(surveyMeta.requests || {});
    const eligibleCount = reqs.filter((r) => r.eligible).length;
    const submittedCount = reqs.filter((r) => r.eligible && r.choice1).length;
    return {
      total: roster.length,
      eligible: eligibleCount,
      submitted: submittedCount,
    };
  }, [roster.length, surveyMeta.requests]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div
        className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        {/* Modal Header */}
        <div
          className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-bold text-foreground">
                סקר מקומות ישיבה ובחירות תלמידים
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              בחר את התלמידים הזכאים להשתתף, שתף איתם את הקישור וסדר את הכיתה אוטומטית לפי ההעדפות שלהם.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* Active / Inactive switch */}
            <button
              onClick={handleToggleActive}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                surveyMeta.isActive
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  surveyMeta.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span>{surveyMeta.isActive ? "הסקר פתוח לבקשות" : "הסקר סגור"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stats & Quick Actions Toolbar */}
        <div
          className="px-5 py-3.5 bg-black/[0.02] dark:bg-white/[0.02] border-b flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{ borderColor: "var(--card-border)" }}
        >
          {/* Counters */}
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              זכאים: <strong className="text-foreground">{stats.eligible}</strong> מתוך {stats.total}
            </span>
            <span className="text-muted-foreground">
              הגישו בקשה: <strong className="text-emerald-600 dark:text-emerald-400">{stats.submitted}</strong>
            </span>
            {copyFeedback && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-fade-in">
                ✓ {copyFeedback}
              </span>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectAll(true)}
              disabled={saving}
              className="px-2.5 py-1 rounded-lg text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 text-foreground transition-all cursor-pointer"
            >
              סמן את כולם כזכאים
            </button>
            <button
              onClick={() => handleSelectAll(false)}
              disabled={saving}
              className="px-2.5 py-1 rounded-lg text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              נקה בחירה
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש תלמיד/ה ברשימה..."
            className="w-full rounded-xl px-3.5 py-2 text-xs text-foreground bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none transition-all"
          />
        </div>

        {/* Students Table / List */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span>טוען נתוני סקר...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              לא נמצאו תלמידים התואמים את החיפוש.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((name) => {
                const req = surveyMeta.requests[name];
                const isEligible = !!req?.eligible;
                const hasSubmitted = !!req?.choice1;
                const c1 = req?.choice1;
                const c2 = req?.choice2;
                const token = req?.token || "";

                const isC1Mutual = c1 && mutualStudents.has(`${name}::${c1}`);
                const isC2Mutual = c2 && mutualStudents.has(`${name}::${c2}`);

                return (
                  <div
                    key={name}
                    className={`rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      isEligible
                        ? "bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10"
                        : "opacity-60 bg-transparent border border-black/5 dark:border-white/5"
                    }`}
                  >
                    {/* Student Name & Eligibility checkbox */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isEligible}
                        onChange={() => handleToggleEligible(name)}
                        className="w-4 h-4 rounded text-violet-600 cursor-pointer accent-violet-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{name}</span>
                          {isEligible ? (
                            hasSubmitted ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                                ✓ הגיש/ה
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium border border-amber-500/30">
                                ⏳ ממתין
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground">לא זכאי/ת</span>
                          )}
                        </div>

                        {/* Choices view */}
                        {isEligible && hasSubmitted && (
                          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                            <span>
                              1: <strong className="text-foreground">{c1}</strong>
                              {isC1Mutual && (
                                <span className="mr-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  (🤝 הדדי!)
                                </span>
                              )}
                            </span>
                            {c2 && (
                              <span>
                                • 2: <strong className="text-foreground">{c2}</strong>
                                {isC2Mutual && (
                                  <span className="mr-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    (🤝 הדדי!)
                                  </span>
                                )}
                              </span>
                            )}
                            {req.note && (
                              <span className="text-violet-600 dark:text-violet-400" title={req.note}>
                                📝 &quot;{req.note}&quot;
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions: Copy Link / WhatsApp */}
                    {isEligible && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          onClick={() => copyToClipboard(getStudentLink(token), `הקישור של ${name} הועתק`)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 text-foreground transition-all cursor-pointer flex items-center gap-1"
                          title="העתק קישור ישיר"
                        >
                          <span>📋</span>
                          <span>קישור</span>
                        </button>

                        <button
                          onClick={() =>
                            copyToClipboard(getWhatsAppMessage(name, token), `הודעת וואטסאפ ל${name} הועתקה`)
                          }
                          className="px-2.5 py-1 rounded-lg text-xs bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1"
                          title="העתק נוסח הודעה לוואטסאפ"
                        >
                          <span>💬</span>
                          <span>וואטסאפ</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer & Actions */}
        <div
          className="p-5 border-t bg-black/[0.02] dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderColor: "var(--card-border)" }}
        >
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            לאחר הסידור האוטומטי, תוכל/י להמשיך לערוך ולגרור מקומות באופן חופשי על גבי הלוח.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              סגור
            </button>

            <button
              onClick={() => {
                onApplyAutoSeating(surveyMeta.requests);
                onClose();
              }}
              disabled={stats.submitted === 0}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>✨</span>
              <span>סדר מקומות ישיבה לפי הבקשות</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
