"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScheduleRow {
  id: string;
  order: number;
  period: string;
  time: string;
  type: string;
  sun: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri"] as const;
const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

export default function EmergencySchedule({ classId }: { classId: string }) {
  const [visible, setVisible] = useState(false);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "classes", classId, "meta", "emergency")).then(async (d) => {
      if (!d.exists() || !d.data().visible) {
        setLoading(false);
        return;
      }
      setVisible(true);
      const snap = await getDocs(
        query(
          collection(db, "classes", classId, "emergency_schedule"),
          orderBy("order")
        )
      );
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleRow)));
      setLoading(false);
    });
  }, [classId]);

  if (loading || !visible || rows.length === 0) return null;

  return (
    <section id="emergency-schedule" className="py-16 emergency-section border-t">
      <div className="emergency-banner">
        <span>⚠️</span>
        <span>מערכת שעות זמנית – לימוד מרחוק</span>
      </div>

      <h2 className="text-2xl font-bold mb-6 emergency-title">מערכת בחירום</h2>

      <div className="schedule-wrapper">
        <table className="schedule-table emergency-table">
          <thead>
            <tr>
              <th>שיעור</th>
              <th>שעות</th>
              {DAY_LABELS.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === "הפסקה") {
                return (
                  <tr key={row.id} className="schedule-break emergency-break">
                    <td />
                    <td>{row.time}</td>
                    <td colSpan={6}>{row.sun}</td>
                  </tr>
                );
              }
              return (
                <tr key={row.id}>
                  <td className="font-bold emergency-period">{row.period}</td>
                  <td className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.time}
                  </td>
                  {DAYS.map((day) => (
                    <td key={day} className={!row[day] ? "text-muted-foreground/40" : "text-foreground"}>
                      {row[day] || "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
