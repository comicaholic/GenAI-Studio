// frontend/src/components/ui/SectionCard.tsx
import React from "react";

export function SectionCard({
  title, secondary, children, footer,
}: {
  title?: React.ReactNode;
  secondary?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="card">
      {(title || secondary) && (
        <header className="card-head flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>}
          {secondary && <div className="flex items-center gap-2">{secondary}</div>}
        </header>
      )}
      <div className="card-body space-y-4">
        {children}
      </div>
      {footer && (
        <div className="px-5 py-3 border-t border-neutral-200/60 dark:border-neutral-700/60">
          {footer}
        </div>
      )}
    </section>
  );
}
