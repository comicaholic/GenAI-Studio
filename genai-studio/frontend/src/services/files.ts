import { api } from "./api";

export async function listFiles(kind: "source" | "reference" | "context") {
  const { data } = await api.get(`/files/list`, { params: { kind } });
  return data as { files: string[] };
}

export async function loadReferenceByName(name: string) {
  const { data } = await api.get(`/files/load`, { params: { kind: "reference", name } });
  return data as { filename: string; text: string };
}

export async function loadContextByName(filename: string) {                 // NEW
  const { data } = await api.get(`/files/load`, { params: { kind: "context", name: filename } });
  return data as { kind: "context"; filename: string; text: string };
}
