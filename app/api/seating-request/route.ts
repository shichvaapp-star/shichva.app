import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { SeatingSurveyMeta, SeatingRequestItem } from "@/types/seating-request";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();
    const classId = searchParams.get("classId")?.trim() || process.env.NEXT_PUBLIC_CLASS_ID || "kita2";

    if (!token) {
      return NextResponse.json({ error: "חסר מזהה קישור (token)" }, { status: 400 });
    }

    // 1. Fetch survey meta
    const surveyRef = doc(db, "classes", classId, "meta", "seating_survey");
    const surveySnap = await getDoc(surveyRef);

    if (!surveySnap.exists()) {
      return NextResponse.json({ error: "סקר מקומות ישיבה אינו פעיל כרגע" }, { status: 404 });
    }

    const surveyData = surveySnap.data() as SeatingSurveyMeta;

    if (!surveyData.isActive) {
      return NextResponse.json({ error: "סקר מקומות הישיבה נסגר על ידי המורה" }, { status: 403 });
    }

    // Find the request matching this token
    const studentRequest = Object.values(surveyData.requests || {}).find(
      (item) => item.token === token && item.eligible
    );

    if (!studentRequest) {
      return NextResponse.json({ error: "קישור זה אינו תקף או שאינך מורשה לגשת לסקר" }, { status: 404 });
    }

    // 2. Fetch class settings and students roster
    const [settingsSnap, studentsSnap] = await Promise.all([
      getDoc(doc(db, "classes", classId, "meta", "settings")),
      getDoc(doc(db, "classes", classId, "meta", "students")),
    ]);

    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const fullRoster = studentsSnap.exists() ? ((studentsSnap.data()?.list as string[]) ?? []) : [];

    // Filter roster to exclude the student themselves
    const availablePartners = fullRoster
      .map((s) => s.trim())
      .filter((s) => s && s !== studentRequest.studentName)
      .sort((a, b) => a.localeCompare(b, "he"));

    return NextResponse.json({
      studentName: studentRequest.studentName,
      choice1: studentRequest.choice1 || "",
      choice2: studentRequest.choice2 || "",
      note: studentRequest.note || "",
      submittedAt: studentRequest.submittedAt || null,
      availablePartners,
      className: settings.className || "הכיתה שלנו",
      schoolName: settings.schoolName || "",
      theme: settings.theme || "kita2",
    });
  } catch (err: unknown) {
    console.error("Error fetching seating request:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "שגיאה בטעינת נתוני הסקר" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2",
      choice1,
      choice2,
      note = "",
    } = body;

    if (!token) {
      return NextResponse.json({ error: "חסר מזהה קישור (token)" }, { status: 400 });
    }

    if (!choice1?.trim()) {
      return NextResponse.json({ error: "חובה לבחור לפחות עדיפות ראשונה" }, { status: 400 });
    }

    const surveyRef = doc(db, "classes", classId, "meta", "seating_survey");
    const surveySnap = await getDoc(surveyRef);

    if (!surveySnap.exists()) {
      return NextResponse.json({ error: "סקר מקומות ישיבה אינו פעיל" }, { status: 404 });
    }

    const surveyData = surveySnap.data() as SeatingSurveyMeta;

    if (!surveyData.isActive) {
      return NextResponse.json({ error: "סקר מקומות הישיבה נסגר" }, { status: 403 });
    }

    const requests = surveyData.requests || {};
    const matchingKey = Object.keys(requests).find(
      (k) => requests[k].token === token && requests[k].eligible
    );

    if (!matchingKey) {
      return NextResponse.json({ error: "קישור לא תקף או שההרשאה בוטלה" }, { status: 404 });
    }

    const currentItem = requests[matchingKey];

    // Cannot choose themselves
    if (choice1.trim() === currentItem.studentName || choice2?.trim() === currentItem.studentName) {
      return NextResponse.json({ error: "לא ניתן לבחור את עצמך" }, { status: 400 });
    }

    // Cannot choose the same student for both choices
    if (choice2?.trim() && choice1.trim() === choice2.trim()) {
      return NextResponse.json({ error: "עדיפות ראשונה ושנייה חייבות להיות תלמידים שונים" }, { status: 400 });
    }

    // Update item
    const updatedItem: SeatingRequestItem = {
      ...currentItem,
      choice1: choice1.trim(),
      choice2: choice2?.trim() || "",
      note: note.trim(),
      submittedAt: new Date().toISOString(),
    };

    requests[matchingKey] = updatedItem;

    await setDoc(
      surveyRef,
      {
        ...surveyData,
        updatedAt: new Date().toISOString(),
        requests,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "הבחירות שלך נשמרו בהצלחה!",
      submittedAt: updatedItem.submittedAt,
    });
  } catch (err: unknown) {
    console.error("Error submitting seating request:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "שגיאה בשמירת הבחירות" },
      { status: 500 }
    );
  }
}
