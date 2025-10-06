// frontend/src/components/ui/Table.tsx
import React from "react";

export function Table({
  head, children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-neutral-700/60">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800 text-left">
          {head}
        </thead>
        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-700/60">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export const Th: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ className = "", ...props }) => (
  <th {...props} className={`px-4 py-3 font-medium ${className}`} />
);
export const Td: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ className = "", ...props }) => (
  <td {...props} className={`px-4 py-3 align-top ${className}`} />
);
