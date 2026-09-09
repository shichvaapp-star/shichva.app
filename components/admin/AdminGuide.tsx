"use client";

import { useState } from "react";

interface Props {
  items: string[];
}

export default function AdminGuide({ items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-xl mb-2 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-indigo-700 dark:text-indigo-300 font-medium cursor-pointer hover:bg-indigo-500/5 transition-colors"
      >
        <span>💡 מדריך מהיר</span>
        <span className="text-xs opacity-70">{open ? "סגור ▲" : "פתח ▼"}</span>
      </button>

      {open && (
        <ul className="px-4 pb-3 m-0 list-none flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-[0.83rem] text-foreground/85 flex items-start gap-2"
            >
              <span className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
