"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import InstallAppButton from "./InstallAppButton";

const sections = [
  { id: "announcements", label: "הודעות" },
  { id: "schedule", label: "מערכת שעות" },
  { id: "events", label: "אירועים" },
  { id: "seating", label: "מקומות ישיבה" },
  { id: "teachers", label: "מורים" },
  { id: "links", label: "קישורים" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function ClassNav({ classLabel }: { classLabel?: string }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsubscribe();
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    const nextDark = !isDark;

    if (!document.startViewTransition) {
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: nextDark ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 400,
          easing: "ease-in-out",
          pseudoElement: nextDark ? "::view-transition-new(root)" : "::view-transition-old(root)",
        }
      );
    });
  };

  return (
    <nav
      className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center gap-2 flex-wrap px-4 py-3 transition-colors duration-300"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--card-border)",
      }}
    >
      {classLabel && (
        <>
          <span className="text-xs font-bold text-foreground px-2 hidden sm:inline-block">
            {classLabel}
          </span>
          <span className="text-foreground/20 text-sm hidden sm:inline-block">|</span>
        </>
      )}

      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => scrollTo(s.id)}
          className="text-sm text-muted-foreground hover:text-foreground px-3.5 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
        >
          {s.label}
        </button>
      ))}

      <span className="text-foreground/20 text-sm">|</span>

      <InstallAppButton />

      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer flex items-center justify-center"
        title={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
        aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 hover:rotate-45">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 hover:-rotate-12">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        )}
      </button>

      {currentUser && (
        <>
          <span className="text-foreground/20 text-sm hidden sm:inline-block">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden md:inline-block max-w-[120px] truncate">
              {currentUser.displayName || currentUser.email?.split("@")[0]}
            </span>
            <button
              onClick={() => signOut(auth)}
              className="text-xs text-muted-foreground hover:text-red-400 px-2.5 py-1 rounded-full hover:bg-red-500/10 transition-all cursor-pointer"
              title="התנתק"
            >
              יציאה
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
