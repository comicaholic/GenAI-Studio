// frontend/src/services/ocr.ts
import { api } from "./api";

export type OCRExtractResponse = {
  file_id: string;
  filename: string;
  pages: string[];
  text: string;
  page_count: number;
};

export async function extractOCR(file: File): Promise<OCRExtractResponse> {
  const form = new FormData();
  form.append("file", file); 
  const res = await api.post<OCRExtractResponse>("/ocr/extract", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

