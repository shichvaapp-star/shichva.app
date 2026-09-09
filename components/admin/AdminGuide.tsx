"use client";

import { useState } from "react";

interface Props {
  items: string[];
}

export default function AdminGuide({ items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "rgba(99,102,241,0.07)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 12,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          fontSize: "0.85rem",
          color: "#a5b4fc",
          cursor: "pointer",
        }}
      >
        <span>💡 מדריך מהיר</span>
        <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{open ? "סגור ▲" : "פתח ▼"}</span>
      </button>

      {open && (
        <ul
          style={{
            padding: "0 16px 12px 16px",
            margin: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {items.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: "0.83rem",
                color: "#cbd5e1",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ color: "#818cf8", marginTop: 1, flexShrink: 0 }}>•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
