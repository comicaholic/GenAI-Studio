import React from "react";

export function Tabs({ tabs, value, onChange }: {
  tabs: { key: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2">
      {tabs.map(t => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition
              ${active
                ? "bg-brand text-white shadow"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              }`}
          >
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );
}
