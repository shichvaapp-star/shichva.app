import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      isTest,
      classId = "kita2",
      recipientEmail,
      fullName,
      email,
      role,
      studentName,
    } = body;

    const gmailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
    const gmailPass =
      process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.GMAIL_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        {
          error:
            "פרטי Gmail (GMAIL_USER ו-GMAIL_APP_PASSWORD) אינם מוגדרים בקובץ הסביבה .env.local",
          configured: false,
        },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // ── Handle Test Email ──
    if (isTest) {
      if (!recipientEmail) {
        return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });
      }

      const info = await transporter.sendMail({
        from: `"אתר שכבת ח׳" <${gmailUser}>`,
        to: recipientEmail,
        subject: "✅ בדיקת מערכת: התראות הרשמה פעילות",
        html: `
          <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="font-size: 36px; margin-bottom: 8px;">📬</div>
              <h2 style="color: #1e1b4b; margin: 0; font-size: 20px;">בדיקת התראות מייל — הצלחה!</h2>
              <p style="color: #64748b; font-size: 13px; margin-top: 4px;">חיבור ה-Gmail הוגדר בהצלחה באתר הכיתה</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; color: #334155; line-height: 1.6;">
              <p style="margin: 0;">הודעה זו מאשרת שהמערכת מוכנה לשלוח התראה למייל זה בכל פעם שמשתמש חדש (תלמיד או הורה) יירשם לאתר הכיתה.</p>
            </div>
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">נשלח אוטומטית מאתר הכיתה</p>
          </div>
        `,
      });

      return NextResponse.json({ success: true, messageId: info.messageId });
    }

    // ── Handle Real Registration Event ──
    console.log("notify-registration processing registration for:", {
      classId,
      fullName,
      email,
      role,
    });

    const settingsSnap = await getDoc(doc(db, "classes", classId, "meta", "settings"));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};

    const notifyEnabled = settings.notifyOnRegistration;
    const targetEmail = settings.notificationEmail?.trim();

    console.log("Class settings retrieved:", {
      classId,
      settingsFound: settingsSnap.exists(),
      notifyEnabled,
      targetEmail,
    });

    if (!notifyEnabled || !targetEmail) {
      console.log("Skipping email notification: notifyEnabled =", notifyEnabled, "targetEmail =", targetEmail);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Notifications disabled or no email set in settings",
      });
    }

    const roleHebrew = role === "parent" ? "👨‍👩‍👧 הורה" : "🎓 תלמיד/ה";
    const origin = request.headers.get("origin") || request.headers.get("host") || "";
    const adminUrl = origin.startsWith("http")
      ? `${origin}/admin`
      : origin
      ? `https://${origin}/admin`
      : "http://localhost:3000/admin";

    const nowFormatted = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    }).format(new Date());

    const emailHtml = `
      <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
          <div style="display: inline-block; font-size: 32px; margin-bottom: 6px;">🔔</div>
          <h1 style="color: #1e1b4b; font-size: 22px; font-weight: 800; margin: 0;">בקשת הרשמה חדשה לאתר הכיתה</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">${settings.className || "אתר הכיתה"} • ${settings.schoolName || ""}</p>
        </div>

        <!-- Alert Card -->
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h2 style="color: #6b21a8; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">פרטי המבקש/ת:</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 110px; font-weight: 600;">שם מלא:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">${fullName || "לא צוין"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">תפקיד / סוג:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${roleHebrew}</td>
            </tr>
            ${
              studentName
                ? `<tr>
                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">שם התלמיד/ה:</td>
                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${studentName}</td>
                  </tr>`
                : ""
            }
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">כתובת אימייל:</td>
              <td style="padding: 6px 0; color: #0f172a; font-family: monospace; direction: ltr; text-align: right;">${email || "לא צוין"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">זמן הבקשה:</td>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px;">${nowFormatted}</td>
            </tr>
          </table>
        </div>

        <!-- Call To Action Button -->
        <div style="text-align: center; margin: 30px 0 24px 0;">
          <a href="${adminUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 13px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);">
            כניסה לפאנל ניהול לאישור הבקשה ←
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; text-align: center;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            הודעה זו נשלחה אוטומטית בהתאם להגדרות ההתראות באתר הכיתה.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"אתר הכיתה" <${gmailUser}>`,
      to: targetEmail,
      subject: `🔔 בקשת הרשמה חדשה: ${fullName || email} (${roleHebrew})`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in notify-registration API:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
