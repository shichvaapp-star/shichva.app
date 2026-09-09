"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  storagePath: string;
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

  const colRef = collection(db, "classes", classId, "gallery");

  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto)));
      setLoading(false);
    });
  }, [classId]);

  async function handleFiles(files: FileList) {
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (allowed.length === 0) return;

    // Add placeholders
    const placeholders = allowed.map((f) => ({ name: f.name, progress: 0 }));
    setUploads((prev) => [...prev, ...placeholders]);

    await Promise.all(
      allowed.map(async (file, i) => {
        const storagePath = `classes/${classId}/gallery/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploads((prev) =>
                prev.map((u, j) => (u.name === file.name && j === i ? { ...u, progress: pct } : u))
              );
            },
            reject,
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              await addDoc(colRef, {
                url,
                storagePath,
                caption: "",
                createdAt: Date.now(),
              });
              resolve();
            }
          );
        });
      })
    );

    setUploads([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (!confirm("למחוק תמונה זו?")) return;
    setDeleting(photo.id);
    try {
      await deleteObject(ref(storage, photo.storagePath));
    } catch {
      // File may already be deleted from storage — continue to remove Firestore doc
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
          <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: 6 }}>
            לחץ לבחירת תמונות או גרור לכאן
          </p>
          <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: 2 }}>
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
                <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ width: `${u.progress}%`, height: "100%", background: "#7c3aed", borderRadius: 2, transition: "width 0.2s" }} />
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
