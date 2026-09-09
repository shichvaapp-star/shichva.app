"use client";

import { useEffect } from "react";

export default function ThemeInitializer({
  classId,
  defaultMode,
}: {
  classId: string;
  defaultMode?: "dark" | "light";
}) {
  useEffect(() => {
    document.body.setAttribute("data-class-theme", classId);
    return () => {
      document.body.removeAttribute("data-class-theme");
    };
  }, [classId]);

  useEffect(() => {
    if (typeof window !== "undefined" && defaultMode) {
      const savedTheme = localStorage.getItem("theme");
      if (!savedTheme) {
        if (defaultMode === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
        }
      }
    }
  }, [defaultMode]);

  return null;
}
