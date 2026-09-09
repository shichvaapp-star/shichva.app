"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SeatingRow {
  id: string;
  order: number;
  desk1_right: string; desk1_left: string;
  desk2_right: string; desk2_left: string;
  desk3_right: string; desk3_left: string;
  desk4_right: string; desk4_left: string;
}

type DeskPair = [string, string];

function DeskUnit({ v1, v2, delay }: { v1: string; v2: string; delay: number }) {
  const isLidor = v1 === "לידור";
  const isEmpty  = !v1 && !v2;
  const isDouble = !isLidor && Boolean(v1) && Boolean(v2);
  const numChairs = isDouble ? 2 : 1;

  const unitClass = [
    "desk-unit",
    isLidor ? "lidor-unit" : "",
    isEmpty  ? "empty"      : "",
    isDouble ? "double"     : "",
    !isDouble && !isLidor && !isEmpty ? "single" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={unitClass} style={{ "--d": `${delay}s` } as React.CSSProperties}>
      <div className="desk-chairs">
        {Array.from({ length: numChairs }).map((_, i) => (
          <div key={i} className="chair-circle" />
        ))}
      </div>
      <div className="desk">
        {isLidor ? (
          <>
            <span className="lidor-name">לידור</span>
            <span className="lidor-role">תומכת למידה</span>
          </>
        ) : isDouble ? (
          <>
            <span className="seat">{v1}</span>
            <span className="seat">{v2}</span>
          </>
        ) : !isEmpty ? (
          <span className="seat">{v1}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function Seating({ classId }: { classId: string }) {
  const [rows, setRows] = useState<SeatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const classroomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocs(query(collection(db, "classes", classId, "seating"), orderBy("order")))
      .then((snapshot) => {
        setRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SeatingRow)));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [classId]);

  useEffect(() => {
    if (!classroomRef.current || rows.length === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(classroomRef.current);
    return () => observer.disconnect();
  }, [rows]);

  const handlePrint = () => {
    document.body.classList.add("print-seating-mode");
    window.print();
    const cleanup = () => {
      document.body.classList.remove("print-seating-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 2000);
  };

  if (loading) return <p className="text-muted-foreground text-center py-5">טוען מקומות ישיבה...</p>;
  if (error)   return <p className="text-red-400 text-center py-5">שגיאה בטעינת מקומות ישיבה</p>;
  if (rows.length === 0) return <p className="text-muted-foreground text-center py-5">אין נתונים</p>;

  return (
    <div id="seating-print-area">
      <div className="flex justify-end mb-3">
        <button
          onClick={handlePrint}
          className="seating-print-btn cursor-pointer active:scale-95"
        >
          🖨️ הדפסה
        </button>
      </div>
    <div ref={classroomRef} className={`classroom${visible ? " visible" : ""}`}>
      <div className="classroom-inner">
        {rows.map((row, rowIdx) => {
          const pairs: DeskPair[] = [
            [row.desk1_right || "", row.desk1_left || ""],
            [row.desk2_right || "", row.desk2_left || ""],
            [row.desk3_right || "", row.desk3_left || ""],
            [row.desk4_right || "", row.desk4_left || ""],
          ];
          return (
            <div key={row.id} className="desk-row">
              {pairs.map(([v1, v2], deskIdx) => (
                <DeskUnit
                  key={deskIdx}
                  v1={v1}
                  v2={v2}
                  delay={(rowIdx * 4 + deskIdx + 1) * 0.05}
                />
              ))}
            </div>
          );
        })}

        <div className="classroom-footer">
          <div className="classroom-door">דלת</div>
          <div className="classroom-board">לוח</div>
        </div>
      </div>
    </div>
    </div>
  );
}
