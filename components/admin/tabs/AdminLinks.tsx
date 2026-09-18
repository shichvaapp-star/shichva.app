"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import AdminGuide from "@/components/admin/AdminGuide";

export interface QuickLinkItem {
  id: string;
  order: number;
  label: string;
  url: string;
  icon: string;
  invertIcon?: boolean;
}

export interface FeaturedLinkItem {
  enabled: boolean;
  label: string;
  sublabel?: string;
  url: string;
  icon: string;
  invertIcon?: boolean;
}

export const DEFAULT_LINKS: Omit<QuickLinkItem, "id">[] = [
  { order: 1, label: "גוגל קלאסרום", url: "https://classroom.google.com", icon: "https://www.google.com/s2/favicons?domain=classroom.google.com&sz=128" },
  { order: 2, label: "משוב תלמידים", url: "https://web.mashov.info/students/main/home", icon: "https://www.google.com/s2/favicons?domain=mashov.info&sz=128" },
  { order: 3, label: "משוב הורים", url: "https://web.mashov.info/parents/main/home", icon: "https://www.google.com/s2/favicons?domain=mashov.info&sz=128" },
  { order: 4, label: "אופק", url: "https://students.myofek.cet.ac.il/", icon: "https://www.google.com/s2/favicons?domain=myofek.cet.ac.il&sz=128" },
  { order: 5, label: "גלים פרו", url: "https://pro.galim.org.il", icon: "https://www.google.com/s2/favicons?domain=galim.org.il&sz=128" },
  { order: 6, label: "מודל", url: "https://moodlemoe.lms.education.gov.il/", icon: "https://www.google.com/s2/favicons?domain=moodlemoe.lms.education.gov.il&sz=128" },
  { order: 7, label: "אתר בית הספר", url: "https://bengurion-herzliya.mashov.info/", icon: "https://www.google.com/s2/favicons?domain=bengurion-herzliya.mashov.info&sz=128", invertIcon: true },
  {
    order: 8,
    label: "תקנון בית הספר",
    url: "https://bengurion-herzliya.mashov.info/wp-content/uploads/sites/225/2024/07/%D7%AA%D7%A7%D7%A0%D7%95%D7%9F-%D7%91%D7%99%D7%AA-%D7%94%D7%A1%D7%A4%D7%A8.pdf-6.pdf",
    icon: "https://www.google.com/s2/favicons?domain=bengurion-herzliya.mashov.info&sz=128",
    invertIcon: true,
  },
];

export const DEFAULT_FEATURED: FeaturedLinkItem = {
  enabled: true,
  label: "שאל את התקנון",
  sublabel: "NotebookLM",
  url: "https://notebooklm.google.com/notebook/5e283b47-066d-4c88-abdb-16f49da9c3c6",
  icon: "https://www.gstatic.com/images/branding/productlogos/notebooklm/v1/192px.svg",
  invertIcon: true,
};

function extractDomain(rawUrl: string): string {
  try {
    const formatted = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(formatted);
    return parsed.hostname;
  } catch {
    return "";
  }
}

interface Props {
  classId: string;
}

export default function AdminLinks({ classId }: Props) {
  const [links, setLinks] = useState<QuickLinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New link state
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newInvertIcon, setNewInvertIcon] = useState(false);
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal / inline edit state
  const [editingItem, setEditingItem] = useState<QuickLinkItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editInvertIcon, setEditInvertIcon] = useState(false);
  const [isUploadingEdit, setIsUploadingEdit] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Featured link state
  const [featured, setFeatured] = useState<FeaturedLinkItem>(DEFAULT_FEATURED);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredSavedSuccess, setFeaturedSavedSuccess] = useState(false);
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const featuredFileInputRef = useRef<HTMLInputElement>(null);

  const [seeding, setSeeding] = useState(false);

  const guideItems = [
    "כאן ניתן לערוך את כפתורי הקישורים המהירים ואת הבאנר המודגש המוצג בתחתית חלק הקישורים.",
    "לוגו הקישור: ניתן להעלות קובץ תמונה ישירות מהמחשב, להזין כתובת URL של תמונה, או ללחוץ על '🌐 שלוף לוגו אוטומטית' כדי לקבל את הסמל הרשמי של האתר.",
    "היפוך צבע לוגו: מיועד לסמלים מונוכרומטיים כהים (כגון סמל שחור של בית הספר) כדי שייראו בבירור גם במצב כהה.",
    "ניתן לשנות את סדר הקישורים בעזרת כפתורי החצים למעלה ולמטה.",
    "אם הרשימה ריקה, ניתן ללחוץ על 'אתחל עם קישורי ברירת מחדל' כדי לטעון מיד את 8 הקישורים הרשמיים של בית הספר.",
  ];

  // Subscribe to links
  useEffect(() => {
    const colRef = collection(db, "classes", classId, "links");
    const q = query(colRef, orderBy("order", "asc"));

    const unsubLinks = onSnapshot(q, (snap) => {
      const list: QuickLinkItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<QuickLinkItem, "id">) });
      });
      setLinks(list);
      setLoading(false);
    });

    const featuredDocRef = doc(db, "classes", classId, "meta", "featuredLink");
    const unsubFeatured = onSnapshot(featuredDocRef, (snap) => {
      if (snap.exists()) {
        setFeatured(snap.data() as FeaturedLinkItem);
      } else {
        setFeatured(DEFAULT_FEATURED);
      }
      setFeaturedLoading(false);
    });

    return () => {
      unsubLinks();
      unsubFeatured();
    };
  }, [classId]);

  // Upload logo to storage
  async function handleUploadLogo(file: File, target: "new" | "edit" | "featured") {
    if (!file.type.startsWith("image/")) {
      alert("אנא בחר קובץ תמונה בלבד (PNG, JPG, SVG, WebP)");
      return;
    }

    if (target === "new") setIsUploadingNew(true);
    if (target === "edit") setIsUploadingEdit(true);
    if (target === "featured") setIsUploadingFeatured(true);

    try {
      const storagePath = `classes/${classId}/links/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          () => {},
          reject,
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (target === "new") setNewIcon(downloadUrl);
            if (target === "edit") setEditIcon(downloadUrl);
            if (target === "featured") setFeatured((prev) => ({ ...prev, icon: downloadUrl }));
            resolve();
          }
        );
      });
    } catch (err) {
      console.error("Failed to upload image:", err);
      // Fallback: Read as data URL if storage rules block
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (target === "new") setNewIcon(dataUrl);
        if (target === "edit") setEditIcon(dataUrl);
        if (target === "featured") setFeatured((prev) => ({ ...prev, icon: dataUrl }));
      };
      reader.readAsDataURL(file);
    } finally {
      if (target === "new") setIsUploadingNew(false);
      if (target === "edit") setIsUploadingEdit(false);
      if (target === "featured") setIsUploadingFeatured(false);
    }
  }

  // Auto-fetch logo using Google favicon service
  function handleAutoFetch(urlToUse: string, target: "new" | "edit" | "featured") {
    const domain = extractDomain(urlToUse);
    if (!domain) {
      alert("אנא הזן קודם כתובת אתר תקינה (למשל: https://example.com)");
      return;
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    if (target === "new") setNewIcon(faviconUrl);
    if (target === "edit") setEditIcon(faviconUrl);
    if (target === "featured") setFeatured((prev) => ({ ...prev, icon: faviconUrl }));
  }

  // Add new link
  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newUrl.trim()) return;

    setIsSubmittingNew(true);
    try {
      const nextOrder = links.length > 0 ? Math.max(...links.map((l) => l.order || 0)) + 1 : 1;
      let finalIcon = newIcon.trim();
      if (!finalIcon) {
        const domain = extractDomain(newUrl);
        finalIcon = domain
          ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
          : "https://www.google.com/s2/favicons?domain=google.com&sz=128";
      }

      const formattedUrl = newUrl.startsWith("http://") || newUrl.startsWith("https://") ? newUrl.trim() : `https://${newUrl.trim()}`;

      await addDoc(collection(db, "classes", classId, "links"), {
        order: nextOrder,
        label: newLabel.trim(),
        url: formattedUrl,
        icon: finalIcon,
        invertIcon: newInvertIcon,
        createdAt: Date.now(),
      });

      setNewLabel("");
      setNewUrl("");
      setNewIcon("");
      setNewInvertIcon(false);
      if (newFileInputRef.current) newFileInputRef.current.value = "";
    } catch (err) {
      console.error("Error adding link:", err);
      alert("אירעה שגיאה בעת הוספת הקישור");
    } finally {
      setIsSubmittingNew(false);
    }
  }

  // Start editing
  function openEdit(item: QuickLinkItem) {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditUrl(item.url);
    setEditIcon(item.icon);
    setEditInvertIcon(!!item.invertIcon);
  }

  // Save edit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmittingEdit(true);
    try {
      const formattedUrl = editUrl.startsWith("http://") || editUrl.startsWith("https://") ? editUrl.trim() : `https://${editUrl.trim()}`;

      await updateDoc(doc(db, "classes", classId, "links", editingItem.id), {
        label: editLabel.trim(),
        url: formattedUrl,
        icon: editIcon.trim(),
        invertIcon: editInvertIcon,
        updatedAt: Date.now(),
      });
      setEditingItem(null);
    } catch (err) {
      console.error("Error updating link:", err);
      alert("אירעה שגיאה בעת עדכון הקישור");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // Delete link
  async function handleDelete(item: QuickLinkItem) {
    if (!confirm(`למחוק את הקישור "${item.label}"?`)) return;
    try {
      await deleteDoc(doc(db, "classes", classId, "links", item.id));
    } catch (err) {
      console.error("Error deleting link:", err);
      alert("אירעה שגיאה בעת מחיקת הקישור");
    }
  }

  // Move link up/down
  async function moveLink(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const currentItem = links[index];
    const targetItem = links[targetIndex];

    try {
      const batch = writeBatch(db);
      const currentRef = doc(db, "classes", classId, "links", currentItem.id);
      const targetRef = doc(db, "classes", classId, "links", targetItem.id);

      batch.update(currentRef, { order: targetItem.order });
      batch.update(targetRef, { order: currentItem.order });
      await batch.commit();
    } catch (err) {
      console.error("Error reordering links:", err);
    }
  }

  // Save featured link
  async function handleSaveFeatured(e: React.FormEvent) {
    e.preventDefault();
    setFeaturedSaving(true);
    setFeaturedSavedSuccess(false);
    try {
      const formattedUrl = featured.url.startsWith("http://") || featured.url.startsWith("https://")
        ? featured.url.trim()
        : `https://${featured.url.trim()}`;

      await setDoc(doc(db, "classes", classId, "meta", "featuredLink"), {
        ...featured,
        url: formattedUrl,
        label: featured.label.trim(),
        sublabel: featured.sublabel?.trim() || "",
        icon: featured.icon.trim(),
        updatedAt: Date.now(),
      });
      setFeaturedSavedSuccess(true);
      setTimeout(() => setFeaturedSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving featured link:", err);
      alert("אירעה שגיאה בעת שמירת הקישור המודגש");
    } finally {
      setFeaturedSaving(false);
    }
  }

  // Seed default links
  async function handleSeedDefaults() {
    if (!confirm("פעולה זו תוסיף את 8 קישורי ברירת המחדל של בית הספר. להמשיך?")) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const def of DEFAULT_LINKS) {
        const newDocRef = doc(collection(db, "classes", classId, "links"));
        batch.set(newDocRef, {
          ...def,
          createdAt: Date.now(),
        });
      }
      await batch.commit();
    } catch (err) {
      console.error("Error seeding default links:", err);
      alert("אירעה שגיאה בטעינת קישורי ברירת המחדל");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">ניהול קישורים ולוגואים</h1>
        <p className="text-xs text-muted-foreground mt-1">
          הוספה, עריכה, שינוי סדר וניהול תמונות הלוגו עבור הקישורים המהירים באתר הכיתה
        </p>
      </div>

      <AdminGuide items={guideItems} />

      {/* Add New Link Card */}
      <div className="admin-card">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <span>➕</span>
          <span>הוספת קישור מהיר חדש</span>
        </h2>

        <form onSubmit={handleAddLink} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">שם הקישור</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="לדוגמה: גוגל קלאסרום"
                required
                className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">כתובת אינטרנט (URL)</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://classroom.google.com"
                required
                dir="ltr"
                className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono text-xs"
              />
            </div>
          </div>

          {/* Logo Section */}
          <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>🖼️</span>
                <span>לוגו הקישור (אייקון)</span>
              </label>
              <button
                type="button"
                onClick={() => handleAutoFetch(newUrl, "new")}
                disabled={!newUrl.trim()}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>🌐 שלוף לוגו אוטומטית לפי כתובת האתר</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Logo Preview */}
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 shrink-0 p-2 relative">
                {newIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newIcon}
                    alt="Preview"
                    className="w-10 h-10 object-contain rounded-md"
                    style={newInvertIcon ? { filter: "var(--logo-filter)" } : undefined}
                    onError={() => setNewIcon("")}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground text-center">אין לוגו</span>
                )}
              </div>

              {/* Logo Inputs */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    placeholder="כתובת תמונה ישירה (URL) או שלוף אוטומטית..."
                    dir="ltr"
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono"
                  />
                  <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-black/10 dark:border-white/10 cursor-pointer transition-colors flex items-center gap-1 shrink-0">
                    <span>{isUploadingNew ? "מעלה..." : "📁 העלה קובץ"}</span>
                    <input
                      ref={newFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadLogo(file, "new");
                      }}
                      disabled={isUploadingNew}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newInvertIcon"
                    checked={newInvertIcon}
                    onChange={(e) => setNewInvertIcon(e.target.checked)}
                    className="rounded accent-violet-600 cursor-pointer"
                  />
                  <label htmlFor="newInvertIcon" className="text-xs text-muted-foreground cursor-pointer select-none">
                    היפוך צבע לוגו (השתמש בלוגו לבן במצב כהה - מיועד לסמלים מונוכרומטיים/שחורים)
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingNew || isUploadingNew || !newLabel.trim() || !newUrl.trim()}
              className="btn-primary flex items-center gap-1.5"
            >
              <span>{isSubmittingNew ? "מוסיף..." : "➕ הוסף קישור"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Links List Card */}
      <div className="admin-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground m-0 flex items-center gap-2">
              <span>🔗</span>
              <span>רשימת הקישורים המהירים ({links.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              הקישורים מוצגים באתר בסדר שנקבע כאן. השתמשו בחצים לשינוי המיקום.
            </p>
          </div>

          {links.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="btn-save text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
            >
              <span>{seeding ? "טוען..." : "📥 אתחל עם קישורי ברירת מחדל"}</span>
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">טוען קישורים...</p>
        ) : links.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-black/15 dark:border-white/15 rounded-xl space-y-3">
            <p className="text-sm text-muted-foreground">אין כרגע קישורים מוגדרים במסד הנתונים.</p>
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="btn-save text-xs py-2 px-4 inline-flex items-center gap-2"
            >
              <span>{seeding ? "טוען..." : "📥 לחץ כאן לטעינת 8 קישורי ברירת המחדל"}</span>
            </button>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>סדר</th>
                  <th style={{ width: "60px" }}>לוגו</th>
                  <th>שם הקישור</th>
                  <th>כתובת URL</th>
                  <th style={{ width: "120px", textAlign: "center" }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {links.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveLink(index, "up")}
                          disabled={index === 0}
                          className="text-xs p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                          title="הזז למעלה"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveLink(index, "down")}
                          disabled={index === links.length - 1}
                          className="text-xs p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 cursor-pointer"
                          title="הזז למטה"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="w-8 h-8 rounded-md bg-black/5 dark:bg-white/10 flex items-center justify-center p-1 border border-black/10 dark:border-white/10">
                        {item.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.icon}
                            alt={item.label}
                            className="w-6 h-6 object-contain rounded"
                            style={item.invertIcon ? { filter: "var(--logo-filter)" } : undefined}
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="font-semibold text-foreground">
                      {item.label}
                      {item.invertIcon && (
                        <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-muted-foreground font-normal">
                          היפוך צבע
                        </span>
                      )}
                    </td>
                    <td>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1 max-w-[240px] truncate"
                        dir="ltr"
                      >
                        <span className="truncate">{item.url}</span>
                        <span>↗</span>
                      </a>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(item)}
                          className="btn-edit"
                          title="ערוך קישור ולוגו"
                        >
                          עריכה
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="btn-danger"
                          title="מחק קישור"
                        >
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Featured Link Card */}
      <div className="admin-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground m-0 flex items-center gap-2">
              <span>⭐</span>
              <span>קישור מודגש (באנר רחב בתחתית הקישורים)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              כפתור בולט עם גרדיאנט המוצג תחת רשת הקישורים (לדוגמה: "שאל את התקנון - NotebookLM")
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={featured.enabled}
              onChange={(e) => setFeatured((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
          </label>
        </div>

        {featuredLoading ? (
          <p className="text-xs text-muted-foreground">טוען נתוני קישור מודגש...</p>
        ) : (
          <form onSubmit={handleSaveFeatured} className="space-y-4 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">כותרת ראשית</label>
                <input
                  type="text"
                  value={featured.label}
                  onChange={(e) => setFeatured((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="לדוגמה: שאל את התקנון"
                  required
                  disabled={!featured.enabled}
                  className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">כותרת משנה (אופציונלי)</label>
                <input
                  type="text"
                  value={featured.sublabel || ""}
                  onChange={(e) => setFeatured((prev) => ({ ...prev, sublabel: e.target.value }))}
                  placeholder="לדוגמה: NotebookLM"
                  disabled={!featured.enabled}
                  className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">כתובת אינטרנט (URL)</label>
              <input
                type="text"
                value={featured.url}
                onChange={(e) => setFeatured((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://notebooklm.google.com/..."
                required
                dir="ltr"
                disabled={!featured.enabled}
                className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono text-xs disabled:opacity-50"
              />
            </div>

            {/* Featured Logo Section */}
            <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>🖼️</span>
                  <span>לוגו הקישור המודגש</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleAutoFetch(featured.url, "featured")}
                  disabled={!featured.enabled || !featured.url.trim()}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>🌐 שלוף לוגו אוטומטית לפי כתובת האתר</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 shrink-0 p-2">
                  {featured.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.icon}
                      alt="Featured Logo"
                      className="w-10 h-10 object-contain rounded-md"
                      style={featured.invertIcon ? { filter: "var(--logo-filter)" } : undefined}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center">אין לוגו</span>
                  )}
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={featured.icon}
                      onChange={(e) => setFeatured((prev) => ({ ...prev, icon: e.target.value }))}
                      placeholder="כתובת תמונה ישירה..."
                      dir="ltr"
                      disabled={!featured.enabled}
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono disabled:opacity-50"
                    />
                    <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-black/10 dark:border-white/10 cursor-pointer transition-colors flex items-center gap-1 shrink-0">
                      <span>{isUploadingFeatured ? "מעלה..." : "📁 העלה קובץ"}</span>
                      <input
                        ref={featuredFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadLogo(file, "featured");
                        }}
                        disabled={!featured.enabled || isUploadingFeatured}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="featuredInvertIcon"
                      checked={!!featured.invertIcon}
                      onChange={(e) => setFeatured((prev) => ({ ...prev, invertIcon: e.target.checked }))}
                      disabled={!featured.enabled}
                      className="rounded accent-violet-600 cursor-pointer"
                    />
                    <label htmlFor="featuredInvertIcon" className="text-xs text-muted-foreground cursor-pointer select-none">
                      היפוך צבע לוגו (השתמש בסמל לבן במצב כהה)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Featured Live Preview */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">תצוגה מקדימה של הכפתור באתר:</span>
              <div
                className="flex items-center justify-center gap-3 py-4 px-4 rounded-xl font-bold text-foreground border border-purple-500/30"
                style={{
                  background: "linear-gradient(135deg, rgba(109,40,217,0.2) 0%, rgba(67,56,202,0.15) 100%)",
                }}
              >
                {featured.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featured.icon}
                    alt={featured.label}
                    className="w-8 h-8 object-contain rounded"
                    style={featured.invertIcon ? { filter: "var(--logo-filter)" } : undefined}
                  />
                )}
                <div className="flex flex-col items-start">
                  <span className="text-base">{featured.label || "שם הקישור המודגש"}</span>
                  {featured.sublabel && (
                    <span className="text-xs text-muted-foreground">{featured.sublabel}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                {featuredSavedSuccess && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span>✓</span>
                    <span>הקישור המודגש נשמר בהצלחה!</span>
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={featuredSaving}
                className="btn-primary flex items-center gap-1.5"
              >
                <span>{featuredSaving ? "שומר..." : "💾 שמור שינויים בבאנר"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Edit Link Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-card-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <span>✏️</span>
                <span>עריכת קישור: {editingItem.label}</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">שם הקישור</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  required
                  className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">כתובת אינטרנט (URL)</label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  required
                  dir="ltr"
                  className="rounded-lg px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono text-xs"
                />
              </div>

              {/* Logo in Edit Modal */}
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">לוגו הקישור</label>
                  <button
                    type="button"
                    onClick={() => handleAutoFetch(editUrl, "edit")}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    🌐 שלוף לוגו אוטומטית
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center p-1 border border-black/10 dark:border-white/10 shrink-0">
                    {editIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editIcon}
                        alt="Edit preview"
                        className="w-8 h-8 object-contain rounded"
                        style={editInvertIcon ? { filter: "var(--logo-filter)" } : undefined}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">ללא</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        placeholder="כתובת תמונה ישירה..."
                        dir="ltr"
                        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/12 focus:border-violet-500 outline-none text-foreground font-mono"
                      />
                      <label className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-black/10 dark:border-white/10 cursor-pointer shrink-0">
                        <span>{isUploadingEdit ? "מעלה..." : "📁 העלה"}</span>
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadLogo(file, "edit");
                          }}
                          disabled={isUploadingEdit}
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="editInvertIcon"
                        checked={editInvertIcon}
                        onChange={(e) => setEditInvertIcon(e.target.checked)}
                        className="rounded accent-violet-600 cursor-pointer"
                      />
                      <label htmlFor="editInvertIcon" className="text-xs text-muted-foreground cursor-pointer select-none">
                        היפוך צבע לוגו במצב כהה
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn-cancel"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || isUploadingEdit}
                  className="btn-primary"
                >
                  {isSubmittingEdit ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
