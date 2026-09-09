"use client";

import { useEffect } from "react";

export default function ThemeInitializer({ classId }: { classId: string }) {
  useEffect(() => {
    document.body.setAttribute("data-class-theme", classId);
    return () => {
      document.body.removeAttribute("data-class-theme");
    };
  }, [classId]);

  return null;
}
