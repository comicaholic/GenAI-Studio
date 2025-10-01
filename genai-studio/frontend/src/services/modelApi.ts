export type Provider = "local" | "groq";

export type ModelRow = {
  id: string;
  label?: string;
  provider: Provider;
  size?: string | null;
  quant?: string | null;
  tags?: string[];
  path?: string;
};

export type ListResp = {
  local: ModelRow[];
  groq: ModelRow[];
  warning?: { warning?: string; error?: string };
};

export async function listModels(includeGroq = true): Promise<ListResp> {
  const r = await fetch(`/api/models/list?include_groq=${includeGroq ? "true" : "false"}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function addLocalModel(m: Partial<ModelRow> & { id: string }) {
  const r = await fetch(`/api/models/add-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...m, provider: "local" }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function removeLocalModel(id: string) {
  const r = await fetch(`/api/models/local?id=` + encodeURIComponent(id), { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function scanLocal() {
  const r = await fetch(`/api/models/scan`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Hugging Face search
export type HFItem = {
  id: string;
  author?: string;
  likes?: number;
  downloads?: number;
  tags?: string[];
  lastModified?: string;
  private?: boolean;
};
export async function searchHF(q: string, sort: "downloads"|"likes"|"recent" = "downloads", limit = 20): Promise<HFItem[]> {
  const u = new URL(`/api/models/search`, location.origin);
  u.searchParams.set("q", q);
  u.searchParams.set("sort", sort);
  u.searchParams.set("limit", String(limit));
  const r = await fetch(u.toString().replace(location.origin, ""));
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.results as HFItem[];
}
