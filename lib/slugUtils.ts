import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "create",
  "new",
  "login",
  "register",
  "settings",
  "manifest",
  "favicon",
  "static",
  "public",
  "kita2", // Existing original class
]);

const HEBREW_TO_LATIN_MAP: Record<string, string> = {
  א: "a",
  ב: "b",
  ג: "g",
  ד: "d",
  ה: "h",
  ו: "v",
  ז: "z",
  ח: "h",
  ט: "t",
  י: "y",
  כ: "k",
  ך: "k",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "a",
  פ: "p",
  ף: "p",
  צ: "ts",
  ץ: "ts",
  ק: "k",
  ר: "r",
  ש: "sh",
  ת: "t",
};

/**
 * Validates slug format: lowercase letters, numbers, hyphens.
 * Must be 3-30 characters long and cannot start or end with a hyphen.
 */
export function isValidClassSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 30) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Checks if a slug is a reserved system path.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase().trim());
}

/**
 * Automatically suggests a URL-safe slug from school name and class name.
 */
export function generateClassSlug(schoolName: string, className: string): string {
  // Transliterate Hebrew letters to Latin
  function transliterate(str: string): string {
    return str
      .replace(/[\'\"\׳\״]/g, "")
      .split("")
      .map((char) => HEBREW_TO_LATIN_MAP[char] || char)
      .join("");
  }

  // Handle common class numbers
  const cleanedClass = className
    .replace(/כיתה/g, "")
    .replace(/כתה/g, "")
    .trim();

  const latinSchool = transliterate(schoolName.trim().toLowerCase())
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const latinClass = transliterate(cleanedClass.toLowerCase())
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const schoolPart = latinSchool.split("-")[0] || "kita";
  const classPart = latinClass || "1";

  const candidate = `${schoolPart}-${classPart}`.slice(0, 24).replace(/-+$/, "");
  return isValidClassSlug(candidate) ? candidate : `kita-${Date.now().toString().slice(-4)}`;
}

/**
 * Checks in Firestore whether the slug is available.
 */
export async function checkClassSlugAvailable(
  slug: string
): Promise<{ available: boolean; reason?: string }> {
  const cleanSlug = slug.toLowerCase().trim();

  if (!cleanSlug) {
    return { available: false, reason: "נא להזין כתובת אתר" };
  }

  if (cleanSlug.length < 3) {
    return { available: false, reason: "הכתובת קצרה מדי (מינימום 3 תווים)" };
  }

  if (cleanSlug.length > 30) {
    return { available: false, reason: "הכתובת ארוכה מדי (מקסימום 30 תווים)" };
  }

  if (!isValidClassSlug(cleanSlug)) {
    return {
      available: false,
      reason: "הכתובת יכולה להכיל רק אותיות באנגלית, מספרים ומקפים (ללא רווחים)",
    };
  }

  if (isReservedSlug(cleanSlug)) {
    return { available: false, reason: "כתובת זו שמורה למערכת, אנא בחרו כתובת אחרת" };
  }

  try {
    const settingsDoc = await getDoc(doc(db, "classes", cleanSlug, "meta", "settings"));
    if (settingsDoc.exists()) {
      return { available: false, reason: "כתובת זו כבר תפוסה על ידי כיתה אחרת" };
    }
    return { available: true };
  } catch (err) {
    console.error("Error checking slug availability:", err);
    // If check fails due to offline/permission, allow proceeding if valid format
    return { available: true };
  }
}
