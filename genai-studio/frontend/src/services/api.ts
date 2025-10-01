// frontend/src/services/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Helper to POST JSON and return blobs (for CSV/PDF downloads)
export async function postForBlob<T>(url: string, body: T) {
  const res = await api.post(url, body, { responseType: "blob" });
  return res.data;
}
