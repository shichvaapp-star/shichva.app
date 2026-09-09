"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminGuide from "@/components/admin/AdminGuide";
import { uploadFileToCloudinary } from "@/lib/uploadClient";
import { Upload, RotateCcw, Image as ImageIcon, LayoutGrid, Check, Sun, Moon } from "lucide-react";

interface Props {
  classId: string;
}

export interface ClassModules {
  announcements?: boolean;
  schedule?: boolean;
  events?: boolean;
  seating?: boolean;
  teachers?: boolean;
  gallery?: boolean;
  links?: boolean;
}

export interface ClassSettings {
  className?: string;
  schoolName?: string;
  theme?: string;
  logoUrl?: string;
  notifyOnRegistration?: boolean;
  notificationEmail?: string;
  motto?: string;
  bgStyle?: "geometric" | "grid" | "stars" | "minimal";
  mascot?: string;
  coverUrl?: string;
  defaultMode?: "dark" | "light";
  modules?: ClassModules;
  fontStyle?: "modern" | "rounded" | "classic";
}

const THEME_OPTIONS = [
  { id: "kita1", label: "כחול שמיים", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  { id: "kita2", label: "סגול מלכותי", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.4)" },
  { id: "kita3", label: "ירוק אמרלד", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  { id: "kita4", label: "כתום שקיעה", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  { id: "kita5", label: "ורוד מודרני", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.4)" },
];

const MASCOT_PRESETS = ["", "🦁", "🚀", "🦉", "🎨", "⭐", "🌱", "🐬", "🐝", "🏆", "💡", "🐾", "🌈", "🔥", "⚽", "📚"];

const BG_OPTIONS = [
  { id: "geometric", label: "טבעות גאומטריות", desc: "סגנון דינמי עם מעגלים וקווים אלכסוניים", icon: "🪐" },
  { id: "grid", label: "רשת מודרנית", desc: "רשת הייטק עדינה עם נקודות הצטלבות", icon: "📐" },
  { id: "stars", label: "כוכבים וניצוצות", desc: "קבוצות כוכבים זוהרות ואפקט שמיים", icon: "✨" },
  { id: "minimal", label: "נקי ומינימליסטי", desc: "רקע חלק ועדין ללא אלמנטים גרפיים", icon: "◽" },
] as const;

const FONT_OPTIONS = [
  { id: "modern", name: "אלף (Alef)", desc: "מודרני, נקי וחד", className: "font-modern" },
  { id: "rounded", name: "ורלה ראונד (Varela Round)", desc: "עגול, חם ומזמין", className: "font-rounded" },
  { id: "classic", name: "אסיסטנט (Assistant)", desc: "אלגנטי, מובנה ומסודר", className: "font-classic" },
] as const;

const MODULE_ITEMS: { key: keyof ClassModules; label: string; icon: string; desc: string }[] = [
  { key: "announcements", label: "הודעות המחנך", icon: "📢", desc: "פרסום עדכונים שוטפים, הודעות וקבצים חשובים" },
  { key: "schedule", label: "מערכת שעות שבועית", icon: "📅", desc: "לוח זמנים יומי ושבועי לתלמידי הכיתה" },
  { key: "events", label: "אירועים ומבחנים", icon: "🗓️", desc: "לוח בחינות, מועדים מיוחדים ואירועי שיא" },
  { key: "seating", label: "מקומות ישיבה", icon: "🪑", desc: "מפת ישיבה אינטראקטיבית של הכיתה" },
  { key: "teachers", label: "צוות המורים", icon: "👥", desc: "רשימת המורים המקצועיים ופרטי קשר" },
  { key: "gallery", label: "גלריית תמונות", icon: "🖼️", desc: "תמונות וחוויות מאירועים ופעילויות כיתתיות" },
  { key: "links", label: "קישורים חשובים", icon: "🔗", desc: "קישורים לאתרי למידה, משוב, משרד החינוך ועוד" },
];

export default function AdminSettings({ classId }: Props) {
  const [className, setClassName] = useState("כיתה ח׳2");
  const [schoolName, setSchoolName] = useState("חטיבת הביניים בן גוריון הרצליה");
  const [theme, setTheme] = useState("kita2");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // 7 New Design States
  const [motto, setMotto] = useState("");
  const [bgStyle, setBgStyle] = useState<"geometric" | "grid" | "stars" | "minimal">("geometric");
  const [mascot, setMascot] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [defaultMode, setDefaultMode] = useState<"dark" | "light">("dark");
  const [fontStyle, setFontStyle] = useState<"modern" | "rounded" | "classic">("modern");
  const [modules, setModules] = useState<ClassModules>({
    announcements: true,
    schedule: true,
    events: true,
    seating: true,
    teachers: true,
    gallery: true,
    links: true,
  });

  const [notifyOnRegistration, setNotifyOnRegistration] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const guideItems = [
    "שם הכיתה מוצג בכותרת הראשית של האתר ובפאנל הניהול.",
    "שם בית הספר וסמל המוסד מופיעים בראש האתר — ניתן להעלות סמל מותאם.",
    "באפשרותכם להגדיר מוטו כיתתי, סמל/אימוג׳י מלווה ותמונת נושא פנורמית (Cover).",
    "בחרו את סגנון הרקע, גופן האותיות ומצב התצוגה הראשי (כהה או בהיר).",
    "ברשימת המודולים ניתן לכבות חלקים שאינם רלוונטיים כדי לשמור על האתר נקי וממוקד.",
    "התראות במייל מאפשרות לקבל עדכון מיידי בכל פעם שתלמיד או הורה נרשמים לאתר.",
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, "classes", classId, "meta", "settings"));
        if (snap.exists()) {
          const data = snap.data() as ClassSettings;
          if (data.className) setClassName(data.className);
          if (data.schoolName) setSchoolName(data.schoolName);
          if (data.theme) setTheme(data.theme);
          if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl || "");
          if (data.notifyOnRegistration !== undefined)
            setNotifyOnRegistration(data.notifyOnRegistration);
          if (data.notificationEmail) setNotificationEmail(data.notificationEmail);

          // 7 design features
          if (data.motto !== undefined) setMotto(data.motto || "");
          if (data.bgStyle) setBgStyle(data.bgStyle);
          if (data.mascot !== undefined) setMascot(data.mascot || "");
          if (data.coverUrl !== undefined) setCoverUrl(data.coverUrl || "");
          if (data.defaultMode) setDefaultMode(data.defaultMode);
          if (data.fontStyle) setFontStyle(data.fontStyle);
          if (data.modules) {
            setModules({
              announcements: data.modules.announcements !== false,
              schedule: data.modules.schedule !== false,
              events: data.modules.events !== false,
              seating: data.modules.seating !== false,
              teachers: data.modules.teachers !== false,
              gallery: data.modules.gallery !== false,
              links: data.modules.links !== false,
            });
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [classId]);

  async function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("נא לבחור קובץ תמונה בלבד (PNG, JPG, SVG, WEBP)");
      return;
    }
    setUploadingLogo(true);
    try {
      const res = await uploadFileToCloudinary(file, `shichva/${classId}/branding`);
      setLogoUrl(res.url);
    } catch (err: unknown) {
      console.error("Logo upload error:", err);
      const msg = err instanceof Error ? err.message : "העלאת הסמל נכשלה";
      alert(`שגיאה בהעלאת הסמל: ${msg}`);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleCoverFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("נא לבחור קובץ תמונה בלבד (PNG, JPG, WEBP)");
      return;
    }
    setUploadingCover(true);
    try {
      const res = await uploadFileToCloudinary(file, `shichva/${classId}/branding`);
      setCoverUrl(res.url);
    } catch (err: unknown) {
      console.error("Cover upload error:", err);
      const msg = err instanceof Error ? err.message : "העלאת תמונת הנושא נכשלה";
      alert(`שגיאה בהעלאת תמונת הנושא: ${msg}`);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await setDoc(
        doc(db, "classes", classId, "meta", "settings"),
        {
          className: className.trim(),
          schoolName: schoolName.trim(),
          theme,
          logoUrl: logoUrl.trim() || null,
          notifyOnRegistration,
          notificationEmail: notificationEmail.trim(),
          motto: motto.trim() || null,
          bgStyle,
          mascot: mascot.trim() || null,
          coverUrl: coverUrl.trim() || null,
          defaultMode,
          fontStyle,
          modules,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("אירעה שגיאה בעת שמירת ההגדרות");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!notificationEmail.trim()) {
      setTestEmailStatus({
        type: "error",
        text: "נא להזין כתובת אימייל תקינה בשדה לפני שליחת בדיקה",
      });
      return;
    }
    setTestingEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await fetch("/api/notify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTest: true,
          recipientEmail: notificationEmail.trim(),
          classId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailStatus({
          type: "success",
          text: "מייל בדיקה נשלח בהצלחה! בדקו את תיבת הדואר הנכנס או הספאם.",
        });
      } else {
        setTestEmailStatus({
          type: "error",
          text: data.error || "שגיאה בשליחת מייל בדיקה. וודאו שפרטי ה-Gmail מוגדרים כראוי.",
        });
      }
    } catch (err) {
      console.error("Test email error:", err);
      setTestEmailStatus({
        type: "error",
        text: "שגיאה בחיבור לשרת הדואר",
      });
    } finally {
      setTestingEmail(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">טוען הגדרות...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminGuide items={guideItems} />

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Details Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>⚙️</span> פרטי האתר והכיתה
          </h2>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">שם הכיתה</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="לדוגמה: כיתה ח׳2 או כיתה ט׳1"
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
            />
            <span className="text-xs text-muted-foreground">יוצג ככותרת הראשית בדף הכיתה.</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">שם בית הספר / מוסד</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="לדוגמה: חטיבת הביניים בן גוריון הרצליה"
              required
              className="w-full rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
            />
            <span className="text-xs text-muted-foreground">מופיע מעל שם הכיתה בכותרת העליונה.</span>
          </div>

          {/* Class Motto */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              מוטו או משפט פתיחה כיתתי (אופציונלי)
            </label>
            <input
              type="text"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="לדוגמה: ״לומדים, גדלים ומצליחים ביחד!״"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
            />
            <span className="text-xs text-muted-foreground">
              מוצג מתחת לשם הכיתה בראש הדף הראשי ומעניק אווירה אישית ומעצימה.
            </span>
          </div>

          {/* Class Mascot / Emoji */}
          <div className="flex flex-col gap-2.5 pt-2">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>סמל / קמע כיתתי (אופציונלי)</span>
              {mascot && (
                <span className="text-xs text-muted-foreground">
                  נבחר: <strong className="text-base mr-1">{mascot}</strong>
                </span>
              )}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setMascot("")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  !mascot ? "bg-black/10 dark:bg-white/15 border-border text-foreground font-bold" : "border-border text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                ללא סמל
              </button>
              {MASCOT_PRESETS.filter(Boolean).map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setMascot(emoji)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    mascot === emoji
                      ? "ring-2 ring-violet-500 bg-violet-500/20 border-violet-500 scale-110"
                      : "border-border hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100"
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={mascot}
                onChange={(e) => setMascot(e.target.value.slice(0, 4))}
                placeholder="הקלד אימוג׳י..."
                className="w-28 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none text-center bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--theme-accent)]"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              מופיע ליד שם הכיתה בכותרת ובסרגל הניווט העליון.
            </span>
          </div>

          {/* School Logo */}
          <div className="flex flex-col gap-2 pt-4 border-t border-border">
            <label className="text-sm font-medium text-foreground">סמל בית הספר</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center p-2 shrink-0 border border-border bg-black/5 dark:bg-white/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl || "/school-logo.png"}
                  alt="סמל בית הספר"
                  className="max-w-full max-h-full object-contain"
                  style={{ filter: logoUrl ? "none" : "var(--logo-filter)" }}
                />
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoFile(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ background: "var(--theme-accent, #7c3aed)", color: "white" }}
                  >
                    {uploadingLogo ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>מעלה סמל...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{logoUrl ? "החלף סמל" : "העלאת סמל חדש"}</span>
                      </>
                    )}
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>שחזר ברירת מחדל</span>
                    </button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  מוצג בראש דף הבית של הכיתה. מומלץ להעלות קובץ PNG שקוף (לפחות 150x150 פיקסלים).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Notifications Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>📬</span> התראות במייל על בקשות הרשמה
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                קבלו הודעה מיידית למייל על כל תלמיד או הורה שנרשמים לאתר עם כפתור אישור מהיר.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={notifyOnRegistration}
                onChange={(e) => setNotifyOnRegistration(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
            </label>
          </div>

          {notifyOnRegistration && (
            <div className="space-y-4 pt-3 border-t border-white/10 animate-in fade-in duration-200">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                  כתובת מייל לקבלת ההתראות (למשל: מייל המחנך/ת)
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="teacher@gmail.com"
                    required={notifyOnRegistration}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testingEmail || !notificationEmail}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-border transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {testingEmail ? "שולח בדיקה..." : "✉️ שלח מייל בדיקה"}
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  כל בקשת הרשמה חדשה תישלח לכתובת זו באופן אוטומטי.
                </span>
              </div>

              {testEmailStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    testEmailStatus.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300"
                  }`}
                >
                  <span>{testEmailStatus.type === "success" ? "✓" : "⚠️"}</span>
                  <span>{testEmailStatus.text}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hero Cover Banner Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-violet-400" />
              <span>תמונת נושא עליונה (Hero Cover Banner)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              הוסיפו תמונת אווירה פנורמית רחבה בראש עמוד הכיתה (למשל תמונת מחזור, כיתה או טיול).
            </p>
          </div>

          {coverUrl ? (
            <div className="space-y-3">
              <div className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden border border-border shadow-md group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt="תמונת נושא"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/90 transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>החלף תמונה</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverUrl("")}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>הסר תמונה</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>תמונת הנושא מוצגת בראש העמוד לפני תוכן הכיתה.</span>
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="text-red-500 hover:text-red-400 underline cursor-pointer"
                >
                  הסר תמונה
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => coverInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-violet-500/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-violet-400 transition-colors" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                לחצו כאן להעלאת תמונת נושא פנורמית
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                מומלץ יחס 16:9 או רחב (JPG, PNG, WEBP עד 10MB)
              </span>
            </div>
          )}

          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCoverFile(file);
            }}
          />

          {uploadingCover && (
            <div className="flex items-center gap-2 text-xs text-violet-500 animate-pulse">
              <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <span>מעלה תמונת נושא לענן...</span>
            </div>
          )}
        </div>

        {/* Design & Appearance Card */}
        <div
          className="rounded-2xl p-6 space-y-6"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>🎨</span> צבע, רקע וטיפוגרפיה (עיצוב האתר)
          </h2>

          {/* Theme Colors */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground block">
              צבע הדגשה מוביל
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected ? "ring-2 ring-offset-2 ring-offset-background" : "border-border bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: isSelected ? opt.bg : undefined,
                      borderColor: isSelected ? opt.border : undefined,
                      outlineColor: opt.color,
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-full mb-2 shadow-sm"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background Art Style */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground block">
                סגנון טקסטורת רקע
              </label>
              <span className="text-xs text-muted-foreground">
                אפקט ויזואלי עדין המשתלב בצבעי הכיתה ברקע העמוד.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BG_OPTIONS.map((opt) => {
                const isSelected = bgStyle === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setBgStyle(opt.id)}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? "bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500"
                        : "border-border bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl p-1.5 rounded-lg bg-black/5 dark:bg-white/5 shrink-0">{opt.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {opt.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-500" />}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hebrew Font Personality */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground block">
                סגנון גופן (טיפוגרפיה בעברית)
              </label>
              <span className="text-xs text-muted-foreground">
                התאימו את אופי הכיתה עם גופנים מותאמים לעברית.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FONT_OPTIONS.map((opt) => {
                const isSelected = fontStyle === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setFontStyle(opt.id)}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500"
                        : "border-border bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {opt.name}
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-500" />}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                    </div>
                    <div className={`text-base font-semibold text-foreground p-2.5 rounded-lg bg-black/5 dark:bg-white/5 ${opt.className}`}>
                      שלום כיתה ח׳2 💫
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Color Mode (Dark vs Light) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground block">
                מצב תצוגה ראשי (ברירת מחדל למבקרים חדשים)
              </label>
              <span className="text-xs text-muted-foreground">
                קובע אם האתר ייפתח תחילה במצב כהה או בהיר (התלמידים עדיין יוכלו להחליף עצמאית לפי נוחיותם).
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setDefaultMode("dark")}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  defaultMode === "dark"
                    ? "bg-violet-500/20 border-violet-500 text-foreground ring-1 ring-violet-500"
                    : "border-border text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Moon className="w-4 h-4 text-violet-400" />
                <span>🌙 מצב כהה (Dark)</span>
              </button>

              <button
                type="button"
                onClick={() => setDefaultMode("light")}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  defaultMode === "light"
                    ? "bg-amber-500/20 border-amber-500 text-foreground ring-1 ring-amber-500"
                    : "border-border text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>☀️ מצב בהיר (Light)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Modules Checklist Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-violet-400" />
              <span>רכיבים ומודולים פעילים באתר</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              התאימו את תוכן האתר לצרכי הכיתה שלכם. רכיבים שתכבו לא יוצגו בדף הכיתה ויוסרו מסרגל הניווט.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {MODULE_ITEMS.map((item) => {
              const isEnabled = modules[item.key] !== false;
              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isEnabled ? "bg-black/[0.02] dark:bg-white/[0.04] border-border" : "opacity-50 border-border bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) =>
                        setModules((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 cursor-pointer shadow-lg"
            style={{
              background: "var(--theme-accent, #7c3aed)",
            }}
          >
            {saving ? "שומר..." : "שמור הגדרות"}
          </button>

          {savedSuccess && (
            <span className="text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-1.5 animate-fade-in">
              <span>✓</span> ההגדרות נשמרו בהצלחה!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
