import { api } from "./api";

export async function listFiles(kind: "source" | "reference" | "context") {
  const r = await fetch(`/api/files/list?kind=${kind}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ files: string[] }>;
}

export async function loadReferenceByName(name: string) {
  const url = new URL(`/api/files/load`, location.origin);
  url.searchParams.set("kind", "reference");
  url.searchParams.set("name", name);
  const r = await fetch(url.toString().replace(location.origin, ""));
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ filename: string; text: string }>;
}

export async function loadContextByName(filename: string) {                 // NEW
  const { data } = await api.get(`/files/load`, { params: { kind: "context", name: filename } });
  return data as { kind: "context"; filename: string; text: string };
}
