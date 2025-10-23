import React from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function RouteError() {
  const err = useRouteError();
  console.error("Route error:", err);

  if (isRouteErrorResponse(err)) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Route error {err.status}</h2>
        <pre>{err.statusText}</pre>
        {err.data && <pre>{JSON.stringify(err.data, null, 2)}</pre>}
      </div>
    );
  }
  return (
    <div style={{ padding: 16 }}>
      <h2>Something went wrong rendering this route.</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>{String(err)}</pre>
    </div>
  );
}
