"use client";

import { useState } from "react";

interface Props {
  items: string[];
}

export default function AdminGuide({ items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 dark:bg-indigo-950/20 dark:border-indigo-500/20 rounded-xl mb-3 overflow-hidden transition-colors">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span>💡</span>
          <span>מדריך מהיר</span>
        </span>
        <span className="text-xs opacity-70">{open ? "סגור ▲" : "פתח ▼"}</span>
      </button>

      {open && (
        <ul className="px-4 pb-3 pt-0 m-0 list-none flex flex-col gap-1.5 border-t border-indigo-500/10 dark:border-indigo-500/10 mt-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 pt-1.5 leading-relaxed"
            >
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

