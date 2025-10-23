// Simple API helpers for the Models page
import axios from "axios";

export type LocalModel = {
  id: string;
  provider: "local";
  label?: string | null;
  size?: string | null;
  quant?: string | null;
  tags?: string[] | null;
};

export type HFItem = {
  id: string;
  author?: string;
  likes?: number;
  downloads?: number;
  tags?: string[];
  lastModified?: string;
  private?: boolean;
};

export async function getLocalModels(): Promise<LocalModel[]> {
  const { data } = await axios.get("/api/models/local");
  return data.models || [];
}

export async function addLocalModel(id: string, extra?: Partial<LocalModel>) {
  await axios.post("/api/models/local", { id, provider: "local", ...extra });
}

export async function removeLocalModel(id: string) {
  await axios.delete("/api/models/local", { params: { id } });
}

export async function searchHF(q: string, sort: "downloads"|"likes"|"recent", limit=25) {
  const { data } = await axios.get("/api/models/search", { params: { q, sort, limit } });
  return (data.results || []) as HFItem[];
}
