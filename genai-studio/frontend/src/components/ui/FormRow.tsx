// frontend/src/components/ui/FormRow.tsx
import React from "react";

export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: 1|2|3|4 }) {
  const map: Record<number, string> = {
    1: "grid grid-cols-1 gap-4",
    2: "grid grid-cols-1 md:grid-cols-2 gap-4",
    3: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
    4: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
  };
  return <div className={map[cols]}>{children}</div>;
}
