"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { uploadFileToCloudinary, deleteUploadedFile } from "@/lib/uploadClient";
import Image from "next/image";

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  storagePath?: string;
  publicId?: string;
  createdAt: number;
}

interface Props {
  classId: string;
}

export default function AdminGallery({ classId }: Props) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colRef = useMemo(() => collection(db, "classes", classId, "gallery"), [classId]);

  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto)));
      setLoading(false);
    });
  }, [colRef]);

  async function handleFiles(files: FileList) {
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (allowed.length === 0) return;

    // Add placeholders
    const placeholders = allowed.map((f) => ({ name: f.name, progress: 0 }));
    setUploads((prev) => [...prev, ...placeholders]);

    await Promise.all(
      allowed.map(async (file, i) => {
        try {
          const folder = `shichva/${classId}/gallery`;
          const res = await uploadFileToCloudinary(file, folder, (pct) => {
            setUploads((prev) =>
              prev.map((u, j) => (u.name === file.name && j === i ? { ...u, progress: pct } : u))
            );
          });

          await addDoc(colRef, {
            url: res.url,
            publicId: res.publicId,
            storagePath: res.publicId,
            caption: "",
            createdAt: Date.now(),
          });
        } catch (err: unknown) {
          console.error("Gallery upload error:", err);
          const msg = err instanceof Error ? err.message : "העלאת התמונה נכשלה";
          alert(`שגיאה בהעלאת ${file.name}: ${msg}`);
        }
      })
    );

    setUploads([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (!confirm("למחוק תמונה זו?")) return;
    setDeleting(photo.id);
    try {
      if (photo.publicId) {
        await deleteUploadedFile(photo.publicId, "image");
      } else if (photo.storagePath && photo.storagePath.startsWith("classes/")) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
        } catch {
          // File may already be deleted from storage
        }
      } else if (photo.storagePath) {
        await deleteUploadedFile(photo.storagePath, "image");
      }
    } catch {
      // Continue to remove Firestore doc
    }
    await deleteDoc(doc(db, "classes", classId, "gallery", photo.id));
    setDeleting(null);
  }

  if (loading)
    return <p className="text-muted-foreground text-center py-12">טוען...</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Upload card */}
      <div className="admin-card">
        <p className="font-semibold text-foreground mb-3">העלאת תמונות</p>
        <div
          className="gallery-upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span style={{ fontSize: "2rem" }}>📷</span>
          <p className="text-sm text-foreground/85 font-medium mt-1.5">
            לחץ לבחירת תמונות או גרור לכאן
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPG, PNG, WEBP · ניתן לבחור מספר תמונות בבת אחת
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }}
        />

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {uploads.map((u, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{u.name}</span>
                  <span>{u.progress}%</span>
                </div>
                <div className="h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div style={{ width: `${u.progress}%`, height: "100%", backgroundColor: "var(--theme-accent)", transition: "width 0.2s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photos grid */}
      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">אין תמונות עדיין. העלה תמונות למעלה.</p>
      ) : (
        <div className="admin-gallery-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="admin-gallery-thumb">
              <Image
                src={photo.url}
                alt={photo.caption || "תמונה"}
                fill
                sizes="160px"
                className="object-cover"
              />
              <button
                className="admin-gallery-delete"
                onClick={() => deletePhoto(photo)}
                disabled={deleting === photo.id}
                title="מחק תמונה"
              >
                {deleting === photo.id ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
