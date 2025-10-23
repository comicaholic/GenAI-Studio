import React from "react";

export default function Bounce({ children, className="" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`rb-bounce ${className}`}>{children}</div>;
}



